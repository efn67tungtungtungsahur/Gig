import type { Detection } from '../domain/visionLabels';
import { hashId } from '../lib/dates';
import type { ImageInput } from './camera';
import type { VisionProgress } from './visionEngine';

// Browser/app wrapper around the on-device model. transformers.js is loaded
// lazily so it doesn't slow down app start.

/** Prompt embeddings are cached per prompt set, so changed prompts are recomputed. */
let cacheKey = '';

async function engine() {
  const [mod, tf] = await Promise.all([import('./visionEngine'), import('@huggingface/transformers')]);
  // Models only come from the Hugging Face hub and are kept in the app's cache storage.
  tf.env.allowLocalModels = false;
  // Use the ONNX runtime WASM bundled with the app instead of fetching it from a CDN,
  // so the scan works offline once the model is cached.
  const wasm = tf.env.backends.onnx.wasm;
  if (wasm) wasm.wasmPaths = undefined;
  cacheKey = `gigfit.vision.prompts.${hashId(`${mod.VISION_MODEL}|${mod.allPrompts().join('|')}`)}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) mod.setPromptEmbeddings(JSON.parse(cached) as number[][]);
  } catch {
    /* no cache */
  }
  return { mod, tf };
}

async function rememberPrompts(embeds: number[][]): Promise<void> {
  try {
    localStorage.setItem(cacheKey, JSON.stringify(embeds.map((v) => v.map((x) => Math.round(x * 1e5) / 1e5))));
  } catch {
    /* storage full – recompute next time */
  }
}

function toBlob(img: ImageInput): Blob {
  const bin = atob(img.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: img.mediaType });
}

/** Downloads the model ahead of time (e.g. on Wi-Fi). */
export async function preloadVisionModel(onProgress?: (p: VisionProgress) => void): Promise<void> {
  const { mod } = await engine();
  await rememberPrompts(await mod.prepareVision(onProgress));
}

export async function scanRoom(images: ImageInput[], onProgress?: (p: VisionProgress) => void): Promise<Detection[]> {
  const { mod, tf } = await engine();
  const raw = await Promise.all(images.map((i) => tf.RawImage.fromBlob(toBlob(i))));
  const detections = await mod.detectEquipment(raw, onProgress);
  await rememberPrompts(await mod.getPromptEmbeddings());
  return detections;
}

/** Whether the model files are already in the cache (then the scan works offline). */
export async function isVisionModelCached(): Promise<boolean> {
  try {
    const cache = await caches.open('transformers-cache');
    const keys = await cache.keys();
    return keys.some((k) => k.url.includes('mobileclip'));
  } catch {
    return false;
  }
}
