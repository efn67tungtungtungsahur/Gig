// Zero-shot labels for the on-device room scan (MobileCLIP). Prompts are in
// English because the model was trained on English captions. This file has no
// imports so the CI verification script can use it directly.

export const EQUIPMENT_PROMPTS: Record<string, string[]> = {
  dumbbells: ['a dumbbell', 'a rack of dumbbells', 'a pair of dumbbells on the floor'],
  barbell: ['a barbell with weight plates', 'an olympic barbell'],
  ez_bar: ['an EZ curl bar'],
  weight_plates: ['weight plates', 'a stack of bumper plates'],
  kettlebell: ['a kettlebell', 'kettlebells on the floor'],
  bench: ['a flat weight bench', 'a workout bench'],
  incline_bench: ['an adjustable incline weight bench'],
  squat_rack: ['a squat rack', 'a power rack', 'a power cage'],
  smith_machine: ['a smith machine'],
  pullup_bar: ['a pull-up bar', 'a doorway pull-up bar'],
  dip_station: ['a dip station', 'parallel dip bars'],
  cable_machine: ['a cable machine', 'a cable crossover machine'],
  lat_pulldown: ['a lat pulldown machine'],
  seated_row: ['a seated cable row machine'],
  chest_press: ['a chest press machine'],
  pec_deck: ['a pec deck butterfly machine'],
  shoulder_press_machine: ['a shoulder press machine'],
  leg_press: ['a leg press machine', 'a 45-degree leg press machine with weight plates', 'a seated leg press machine with a footplate'],
  hack_squat: ['a hack squat machine'],
  leg_extension: ['a leg extension machine'],
  leg_curl: ['a leg curl machine'],
  calf_machine: ['a calf raise machine'],
  hip_abductor: ['a hip abductor machine'],
  back_extension: ['a back extension bench', 'a hyperextension bench'],
  ab_wheel: ['an ab roller wheel'],
  resistance_bands: ['resistance bands', 'elastic exercise bands'],
  trx: ['TRX suspension straps hanging'],
  medicine_ball: ['a medicine ball', 'a rubber slam ball'],
  plyo_box: ['a plyometric box', 'a wooden plyo box'],
  mat: ['a rolled-up yoga mat', 'a single yoga mat lying on the floor'],
  foam_roller: ['a foam roller'],
  battle_ropes: ['battle ropes on the floor'],
  jump_rope: ['a jump rope', 'a skipping rope'],
  treadmill: ['a treadmill', 'a running machine'],
  bike: ['a stationary exercise bike', 'a spinning bike'],
  rower: ['a rowing machine', 'an indoor rower'],
  elliptical: ['an elliptical cross trainer'],
  stair_climber: ['a stair climber machine', 'a stepper machine'],
};

/** Absorb probability when a tile shows nothing gym-related. */
export const BACKGROUND_PROMPTS: string[] = [
  'an empty wall',
  'a floor',
  'a gym floor',
  'black rubber gym flooring',
  'a gym wall with mirrors',
  'a group of people exercising',
  'a reception desk',
  'a ceiling with lights',
  'a window',
  'a door',
  'a mirror on the wall',
  'a person',
  'a chair',
  'a table',
  'a sofa',
  'a bed',
  'a shelf',
  'a cupboard',
  'a plant',
  'a television',
  'a radiator',
];

export interface VisionClass {
  /** Equipment id, or null for background. */
  id: string | null;
  prompts: string[];
}

export function visionClasses(): VisionClass[] {
  return [
    ...Object.entries(EQUIPMENT_PROMPTS).map(([id, prompts]) => ({ id, prompts })),
    ...BACKGROUND_PROMPTS.map((p) => ({ id: null, prompts: [p] })),
  ];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Whole picture, a 3×3 grid and two half crops – equipment is often small in a room photo. */
export function tileRects(width: number, height: number): Rect[] {
  const rects: Rect[] = [{ x: 0, y: 0, w: width, h: height }];
  const tw = Math.floor(width / 2);
  const th = Math.floor(height / 2);
  // Overlapping 3×3 grid of half-size tiles.
  for (let gy = 0; gy < 3; gy++) {
    for (let gx = 0; gx < 3; gx++) {
      rects.push({ x: Math.floor((gx * (width - tw)) / 2), y: Math.floor((gy * (height - th)) / 2), w: tw, h: th });
    }
  }
  rects.push({ x: 0, y: 0, w: tw, h: height }, { x: width - tw, y: 0, w: tw, h: height });
  return rects;
}

export function softmax(values: number[]): number[] {
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function normalize(v: number[]): number[] {
  const n = Math.sqrt(dot(v, v)) || 1;
  return v.map((x) => x / n);
}

/** Mean of the prompt embeddings of each class, re-normalised. */
export function classEmbeddings(classes: VisionClass[], promptEmbeddings: number[][]): number[][] {
  let i = 0;
  return classes.map((c) => {
    const vecs = promptEmbeddings.slice(i, i + c.prompts.length);
    i += c.prompts.length;
    const mean = vecs[0].map((_, k) => vecs.reduce((s, v) => s + v[k], 0) / vecs.length);
    return normalize(mean);
  });
}

export interface Detection {
  id: string;
  confidence: number; // 0–1
}

/** Minimum probability in at least one tile for an item to count as seen. */
export const DETECTION_THRESHOLD = 0.3;

/**
 * Turns per-tile image embeddings into detected equipment. An item counts as
 * present when it wins a tile or reaches the threshold in any tile.
 */
export function detectFromEmbeddings(
  tileEmbeddings: number[][],
  classes: VisionClass[],
  classEmbeds: number[][],
  logitScale = 100,
  threshold = DETECTION_THRESHOLD,
): Detection[] {
  const best = new Map<string, number>();
  for (const tile of tileEmbeddings) {
    const img = normalize(tile);
    const probs = softmax(classEmbeds.map((c) => logitScale * dot(img, c)));
    let top = 0;
    for (let k = 1; k < probs.length; k++) if (probs[k] > probs[top]) top = k;
    probs.forEach((p, k) => {
      const id = classes[k].id;
      if (!id) return;
      const wins = k === top && p >= threshold * 0.6;
      if (p >= threshold || wins) best.set(id, Math.max(best.get(id) ?? 0, p));
    });
  }
  return [...best.entries()].map(([id, confidence]) => ({ id, confidence })).sort((a, b) => b.confidence - a.confidence);
}
