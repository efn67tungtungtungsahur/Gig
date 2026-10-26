import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
  type PreTrainedTokenizer,
  type Processor,
  type ProgressInfo,
} from '@huggingface/transformers';
import { classEmbeddings, detectFromEmbeddings, tileRects, visionClasses, type Detection } from '../domain/visionLabels';

// Free, open MobileCLIP model from Hugging Face. It is downloaded once,
// cached on the phone and then runs offline – no account, no API costs.
// No Capacitor imports here so the CI check can run the same code in Node.

export const VISION_MODEL = 'Xenova/mobileclip_s0';
export const TEXT_DTYPE = 'q8';
export const VISION_DTYPE = 'fp32';

export interface VisionProgress {
  phase: 'laden' | 'analysieren';
  /** 0–100 */
  percent: number;
}

type ProgressFn = (p: VisionProgress) => void;

let tokenizer: PreTrainedTokenizer | null = null;
let textModel: CLIPTextModelWithProjection | null = null;
let processor: Processor | null = null;
let visionModel: CLIPVisionModelWithProjection | null = null;
let promptEmbeddings: number[][] | null = null;

/** All prompts in class order (equipment + background). */
export function allPrompts(): string[] {
  return visionClasses().flatMap((c) => c.prompts);
}

function downloadTracker(onProgress?: ProgressFn) {
  const files = new Map<string, { loaded: number; total: number }>();
  return (info: ProgressInfo) => {
    if (info.status !== 'progress' || !onProgress) return;
    files.set(info.file, { loaded: info.loaded, total: info.total });
    let loaded = 0;
    let total = 0;
    for (const f of files.values()) {
      loaded += f.loaded;
      total += f.total;
    }
    if (total > 0) onProgress({ phase: 'laden', percent: Math.min(99, Math.round((loaded / total) * 100)) });
  };
}

/** Uses prompt embeddings cached from an earlier run, so the text model needn't load again. */
export function setPromptEmbeddings(embeds: number[][] | null): void {
  promptEmbeddings = embeds && embeds.length === allPrompts().length ? embeds : null;
}

export async function getPromptEmbeddings(onProgress?: ProgressFn): Promise<number[][]> {
  if (promptEmbeddings) return promptEmbeddings;
  const progress_callback = downloadTracker(onProgress);
  tokenizer ??= await AutoTokenizer.from_pretrained(VISION_MODEL, { progress_callback });
  textModel ??= await CLIPTextModelWithProjection.from_pretrained(VISION_MODEL, { dtype: TEXT_DTYPE, device: 'wasm', progress_callback });
  const inputs = tokenizer(allPrompts(), { padding: 'max_length', truncation: true });
  const { text_embeds } = await textModel(inputs);
  promptEmbeddings = text_embeds.tolist() as number[][];
  return promptEmbeddings;
}

async function loadVision(onProgress?: ProgressFn): Promise<void> {
  const progress_callback = downloadTracker(onProgress);
  processor ??= await AutoProcessor.from_pretrained(VISION_MODEL, { progress_callback });
  visionModel ??= await CLIPVisionModelWithProjection.from_pretrained(VISION_MODEL, { dtype: VISION_DTYPE, device: 'wasm', progress_callback });
}

/** Downloads (or loads from cache) everything the scan needs. */
export async function prepareVision(onProgress?: ProgressFn): Promise<number[][]> {
  const embeds = await getPromptEmbeddings(onProgress);
  await loadVision(onProgress);
  return embeds;
}

/** Detects gym equipment on the given photos. */
export async function detectEquipment(images: RawImage[], onProgress?: ProgressFn): Promise<Detection[]> {
  const embeds = await prepareVision(onProgress);
  const classes = visionClasses();
  const classEmbeds = classEmbeddings(classes, embeds);
  const merged = new Map<string, number>();
  let done = 0;
  const totalTiles = images.reduce((n, img) => n + tileRects(img.width, img.height).length, 0);
  for (const image of images) {
    const rects = tileRects(image.width, image.height);
    const tileEmbeds: number[][] = [];
    for (const r of rects) {
      const crop = await image.crop([r.x, r.y, r.x + r.w - 1, r.y + r.h - 1]);
      const inputs = await processor!(crop);
      const { image_embeds } = await visionModel!(inputs);
      tileEmbeds.push((image_embeds.tolist() as number[][])[0]);
      done++;
      onProgress?.({ phase: 'analysieren', percent: Math.round((done / totalTiles) * 100) });
    }
    for (const d of detectFromEmbeddings(tileEmbeds, classes, classEmbeds)) {
      merged.set(d.id, Math.max(merged.get(d.id) ?? 0, d.confidence));
    }
  }
  return [...merged.entries()].map(([id, confidence]) => ({ id, confidence })).sort((a, b) => b.confidence - a.confidence);
}
