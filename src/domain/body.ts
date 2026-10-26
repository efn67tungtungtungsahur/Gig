// Körperübersicht: muscle ranks from strength standards, current load and weekly sets per muscle.

import { EXERCISES, type Exercise } from './exercises';
import { doneSets, estimated1RM } from './workoutLog';
import type { AppData, MuscleGroup, Settings } from './types';

/** Muscles shown on the body figure (cardio has no place on it). */
export const BODY_MUSCLES: MuscleGroup[] = ['brust', 'schultern', 'ruecken', 'bizeps', 'trizeps', 'core', 'beine', 'po', 'beinbeuger', 'waden'];

const LOWER_BODY = new Set<MuscleGroup>(['beine', 'po', 'beinbeuger', 'waden']);

// ---------------------------------------------------------------------------
// Ranks

export const RANK_NAMES = ['Holz', 'Bronze', 'Silber', 'Gold', 'Platin', 'Diamant', 'Champion', 'Olympionike'] as const;
const DIVISIONS = ['III', 'II', 'I'];

/**
 * Lower bound of each of the 24 levels (Holz III … Olympionike I) as a share of
 * the "intermediate" standard. Anchors: beginner 0.5, novice 0.71,
 * intermediate 1.0, advanced 1.35, elite 1.73.
 */
const LEVEL_FLOORS = [
  0, 0.12, 0.24, // Holz
  0.35, 0.42, 0.48, // Bronze
  0.55, 0.62, 0.68, // Silber
  0.75, 0.83, 0.91, // Gold
  1.0, 1.1, 1.2, // Platin
  1.3, 1.4, 1.5, // Diamant
  1.6, 1.7, 1.8, // Champion (≈ elite)
  1.9, 2.05, 2.2, // Olympionike (beyond elite)
];
const ANCHOR_FRACS = [0.5, 0.71, 1.0, 1.35, 1.73];
const MAX_SCORE = 2.5;

export interface RankInfo {
  /** 0 = Holz III … 23 = Olympionike I */
  level: number;
  /** 0 = Holz … 7 = Olympionike */
  tier: number;
  name: string;
  /** Share of the way to the next level, 0–1 (1 at the top). */
  progress: number;
  score: number;
}

export function rankFromScore(score: number): RankInfo {
  const s = Math.max(0, Math.min(MAX_SCORE, score));
  let level = 0;
  for (let i = 0; i < LEVEL_FLOORS.length; i++) if (s >= LEVEL_FLOORS[i]) level = i;
  const tier = Math.floor(level / 3);
  const lo = LEVEL_FLOORS[level];
  const hi = LEVEL_FLOORS[level + 1];
  return {
    level,
    tier,
    name: `${RANK_NAMES[tier]} ${DIVISIONS[level % 3]}`,
    progress: hi === undefined ? 1 : (s - lo) / (hi - lo),
    score: s,
  };
}

export function levelName(level: number): string {
  return `${RANK_NAMES[Math.floor(level / 3)]} ${DIVISIONS[level % 3]}`;
}

export function levelFloor(level: number): number | undefined {
  return LEVEL_FLOORS[level];
}

// ---------------------------------------------------------------------------
// Strength standards (male, intermediate ≈ 1–2 years of regular training)

type Standard =
  /** One-rep max relative to body weight; dumbbells per hand. */
  | { kind: 'ratio'; anchors: number[] }
  /** Clean reps with body weight (added weight is converted). */
  | { kind: 'reps'; anchors: number[] };

const R = (intermediate: number): Standard => ({ kind: 'ratio', anchors: ANCHOR_FRACS.map((f) => intermediate * f) });
const REPS = (...anchors: number[]): Standard => ({ kind: 'reps', anchors });

const STANDARDS: Record<string, Standard> = {
  bankdruecken: R(1.2),
  kh_bankdruecken: R(0.45),
  schraegbank_kh: R(0.4),
  schraegbank_lh: R(1.0),
  multipresse_bank: R(1.1),
  brustpresse: R(1.15),
  dips: REPS(2, 8, 20, 32, 45),
  liegestuetze: REPS(5, 15, 32, 52, 75),
  kh_flys: R(0.25),
  butterfly: R(0.9),
  kabel_crossover: R(0.35),
  klimmzuege: REPS(1, 4, 13, 24, 36),
  latzug: R(1.0),
  lh_rudern: R(1.0),
  kh_rudern: R(0.5),
  kabelrudern: R(1.0),
  kreuzheben: R(1.9),
  face_pulls: R(0.45),
  schulterdruecken_kh: R(0.33),
  military_press: R(0.75),
  schulterpresse: R(0.8),
  pike_pushups: REPS(2, 6, 15, 25, 40),
  seitheben: R(0.18),
  seitheben_kabel: R(0.12),
  frontheben: R(0.15),
  reverse_flys: R(0.12),
  chin_ups: REPS(1, 5, 14, 25, 37),
  kh_curls: R(0.25),
  sz_curls: R(0.55),
  lh_curls: R(0.6),
  hammer_curls: R(0.27),
  kabel_curls: R(0.5),
  trizeps_kabel: R(0.6),
  french_press: R(0.45),
  overhead_trizeps: R(0.3),
  kickbacks: R(0.13),
  bank_dips: REPS(5, 12, 25, 40, 55),
  enge_liegestuetze: REPS(3, 10, 25, 40, 60),
  kniebeuge: R(1.6),
  multipresse_kniebeuge: R(1.5),
  goblet_squat: R(0.55),
  beinpresse: R(2.6),
  hackenschmidt: R(1.9),
  ausfallschritte: R(0.32),
  bulgarian: R(0.3),
  step_ups: R(0.3),
  kniebeuge_bw: REPS(10, 25, 45, 70, 100),
  beinstrecker: R(1.0),
  beinbeuger: R(0.75),
  rdl_kh: R(0.55),
  kb_swing: R(0.5),
  hip_thrust: R(1.7),
  glute_bridge: REPS(10, 20, 35, 55, 80),
  abduktoren: R(1.0),
  kabel_kickbacks: R(0.25),
  wadenmaschine: R(1.5),
  waden_beinpresse: R(2.0),
  wadenheben: REPS(10, 20, 35, 50, 70),
  crunches: REPS(10, 25, 45, 70, 100),
  beinheben: REPS(2, 6, 14, 22, 32),
  kabel_crunch: R(0.8),
  ab_wheel: REPS(2, 6, 14, 24, 35),
};

/** Rough factors for the female standards (upper body / lower body). */
const FEMALE = { ratio: [0.6, 0.72], reps: [0.5, 0.75] };

function standardFor(ex: Exercise, sex: 'm' | 'w'): Standard | undefined {
  const base = STANDARDS[ex.id];
  if (!base || sex === 'm') return base;
  const lower = LOWER_BODY.has(ex.muscles[0]) ? 1 : 0;
  const f = base.kind === 'ratio' ? FEMALE.ratio[lower] : FEMALE.reps[lower];
  return { kind: base.kind, anchors: base.anchors.map((a) => a * f) };
}

/** Piecewise-linear position of a value on the anchor scale (0.5 = beginner … 1.73 = elite). */
function scoreOnScale(value: number, anchors: number[]): number {
  if (value <= 0) return 0;
  if (value <= anchors[0]) return (value / anchors[0]) * ANCHOR_FRACS[0];
  for (let i = 1; i < anchors.length; i++) {
    if (value <= anchors[i]) {
      const t = (value - anchors[i - 1]) / (anchors[i] - anchors[i - 1]);
      return ANCHOR_FRACS[i - 1] + t * (ANCHOR_FRACS[i] - ANCHOR_FRACS[i - 1]);
    }
  }
  const n = anchors.length - 1;
  const slope = (ANCHOR_FRACS[n] - ANCHOR_FRACS[n - 1]) / (anchors[n] - anchors[n - 1]);
  return Math.min(MAX_SCORE, ANCHOR_FRACS[n] + (value - anchors[n]) * slope);
}

/** Inverse of scoreOnScale: the value needed for a score. */
function valueForScore(score: number, anchors: number[]): number {
  if (score <= ANCHOR_FRACS[0]) return (score / ANCHOR_FRACS[0]) * anchors[0];
  for (let i = 1; i < anchors.length; i++) {
    if (score <= ANCHOR_FRACS[i]) {
      const t = (score - ANCHOR_FRACS[i - 1]) / (ANCHOR_FRACS[i] - ANCHOR_FRACS[i - 1]);
      return anchors[i - 1] + t * (anchors[i] - anchors[i - 1]);
    }
  }
  const n = anchors.length - 1;
  const slope = (anchors[n] - anchors[n - 1]) / (ANCHOR_FRACS[n] - ANCHOR_FRACS[n - 1]);
  return anchors[n] + (score - ANCHOR_FRACS[n]) * slope;
}

/** Reps you could do with body weight alone, for a set with extra weight (Epley). */
function repsAtBodyWeight(bodyWeight: number, added: number, reps: number): number {
  if (added <= 0) return reps;
  return 30 * (((bodyWeight + added) / bodyWeight) * (1 + reps / 30) - 1);
}

export interface SetScore {
  score: number;
  /** One-rep max (kg) or reps at body weight, depending on the standard. */
  value: number;
  kind: 'ratio' | 'reps';
}

export function scoreSet(ex: Exercise, weight: number, reps: number, bodyWeight: number, sex: 'm' | 'w'): SetScore | undefined {
  const std = standardFor(ex, sex);
  if (!std || reps <= 0) return undefined;
  if (std.kind === 'ratio') {
    if (weight <= 0) return undefined;
    // Epley gets unreliable past ~15 reps.
    const e1rm = estimated1RM(weight, Math.min(reps, 15));
    return { score: scoreOnScale(e1rm / bodyWeight, std.anchors), value: e1rm, kind: 'ratio' };
  }
  const r = repsAtBodyWeight(bodyWeight, weight, reps);
  return { score: scoreOnScale(r, std.anchors), value: r, kind: 'reps' };
}

// ---------------------------------------------------------------------------
// Collecting the training data

const ALIASES: Record<string, string> = {
  'bench press': 'bankdruecken',
  'barbell bench press': 'bankdruecken',
  'dumbbell bench press': 'kh_bankdruecken',
  'incline dumbbell press': 'schraegbank_kh',
  'incline bench press': 'schraegbank_lh',
  'chest press': 'brustpresse',
  'chest fly': 'kh_flys',
  'dumbbell fly': 'kh_flys',
  'pec deck': 'butterfly',
  'cable crossover': 'kabel_crossover',
  dips: 'dips',
  'push up': 'liegestuetze',
  'pull up': 'klimmzuege',
  'chin up': 'chin_ups',
  'lat pulldown': 'latzug',
  'barbell row': 'lh_rudern',
  'bent over row': 'lh_rudern',
  'dumbbell row': 'kh_rudern',
  'seated cable row': 'kabelrudern',
  'cable row': 'kabelrudern',
  deadlift: 'kreuzheben',
  'face pull': 'face_pulls',
  'overhead press': 'military_press',
  'military press': 'military_press',
  'shoulder press': 'schulterdruecken_kh',
  'dumbbell shoulder press': 'schulterdruecken_kh',
  'machine shoulder press': 'schulterpresse',
  'lateral raise': 'seitheben',
  'front raise': 'frontheben',
  'reverse fly': 'reverse_flys',
  'bicep curl': 'kh_curls',
  'dumbbell curl': 'kh_curls',
  'barbell curl': 'lh_curls',
  'ez bar curl': 'sz_curls',
  'hammer curl': 'hammer_curls',
  'cable curl': 'kabel_curls',
  'tricep pushdown': 'trizeps_kabel',
  'triceps pushdown': 'trizeps_kabel',
  'skull crusher': 'french_press',
  'overhead tricep extension': 'overhead_trizeps',
  squat: 'kniebeuge',
  'back squat': 'kniebeuge',
  'barbell squat': 'kniebeuge',
  'goblet squat': 'goblet_squat',
  'leg press': 'beinpresse',
  'hack squat': 'hackenschmidt',
  lunge: 'ausfallschritte',
  'bulgarian split squat': 'bulgarian',
  'leg extension': 'beinstrecker',
  'leg curl': 'beinbeuger',
  'lying leg curl': 'beinbeuger',
  'seated leg curl': 'beinbeuger',
  'romanian deadlift': 'rdl_kh',
  'hip thrust': 'hip_thrust',
  'glute bridge': 'glute_bridge',
  'calf raise': 'wadenmaschine',
  crunch: 'crunches',
  'hanging leg raise': 'beinheben',
  'cable crunch': 'kabel_crunch',
};

function normalizeName(name: string): string {
  return name
    .toLocaleLowerCase('de-DE')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-zäöüß ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const BY_NAME = new Map<string, Exercise>();
for (const e of EXERCISES) {
  BY_NAME.set(normalizeName(e.name), e);
  BY_NAME.set(e.name.toLocaleLowerCase('de-DE'), e);
}
const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

/** Catalogue exercise for an id or a (German or English) name. */
export function findExercise(entry: { exerciseId?: string; name: string }): Exercise | undefined {
  if (entry.exerciseId && BY_ID.has(entry.exerciseId)) return BY_ID.get(entry.exerciseId);
  const raw = entry.name.toLocaleLowerCase('de-DE').trim();
  const n = normalizeName(entry.name);
  const singular = n.replace(/s$/, '');
  const id = ALIASES[n] ?? ALIASES[singular] ?? ALIASES[n.replace(/-/g, ' ')];
  return BY_NAME.get(raw) ?? BY_NAME.get(n) ?? (id ? BY_ID.get(id) : undefined);
}

export interface Performance {
  date: string; // ISO
  exercise: Exercise;
  weight: number;
  reps: number;
  /** Number of sets this entry stands for (Liftoff only reports the best set). */
  sets: number;
}

/** All sets from the app's workout log and Liftoff, matched to the catalogue. */
export function collectPerformances(data: AppData): Performance[] {
  const out: Performance[] = [];
  const loggedStarts: number[] = [];
  for (const w of data.workoutLog) {
    if (!w.end) continue;
    loggedStarts.push(new Date(w.start).getTime());
    for (const e of w.exercises) {
      const ex = findExercise(e);
      if (!ex) continue;
      for (const s of doneSets(e)) out.push({ date: w.start, exercise: ex, weight: s.weight ?? 0, reps: s.reps ?? 0, sets: 1 });
    }
  }
  for (const w of data.liftoff.workouts) {
    const t = new Date(w.start).getTime();
    // The same session logged in the app wins.
    if (loggedStarts.some((l) => Math.abs(l - t) < 30 * 60_000)) continue;
    for (const e of w.exercises ?? []) {
      const ex = findExercise(e);
      if (!ex) continue;
      out.push({ date: w.start, exercise: ex, weight: e.bestWeight ?? 0, reps: e.reps ?? 0, sets: Math.max(1, e.sets) });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Analysis

export interface BestLift {
  exercise: Exercise;
  weight: number;
  reps: number;
  date: string;
  score: number;
  value: number;
  kind: 'ratio' | 'reps';
  /** Counted via a secondary muscle (reduced). */
  secondary: boolean;
}

export interface NextGoal {
  level: number;
  name: string;
  exercise: Exercise;
  /** Weight to lift for `reps` reps (ratio standards). */
  weight?: number;
  reps: number;
}

export interface MuscleStatus {
  muscle: MuscleGroup;
  rank: RankInfo | null;
  best?: BestLift;
  next?: NextGoal;
  /** Fatigue units (hard sets, decaying with a 24 h half-life). */
  load: number;
  loadLevel: number; // 0 = none … 5 = very high
  /** Remaining energy in percent (100 = fully recovered). */
  energy: number;
  energyLevel: number; // 1 = needs rest … 5 = ready for a hard session
  /** Sets in the last 7 days (secondary muscles count half). */
  weeklySets: number;
  weeklyLevel: number; // 0 = none … 5
  lastTrained?: string;
  /** Hours until the muscle counts as recovered again. */
  recoveredInH: number;
}

export interface BodyAnalysis {
  bodyWeight: number;
  bodyWeightSource: 'withings' | 'manuell' | 'schaetzung';
  standard: 'm' | 'w';
  muscles: MuscleStatus[];
  overall: RankInfo | null;
  /** Muscles with any training data. */
  trainedCount: number;
  insights: string[];
}

const SECONDARY_FACTOR = 0.7;
const HALF_LIFE_H = 24;
const RANK_WINDOW_DAYS = 90;
export const LOAD_THRESHOLDS = [0.5, 2, 4, 6, 9];
export const LOAD_LABELS = ['erholt', 'kaum', 'leicht', 'mittel', 'stark', 'sehr stark'];
/** Energy level 1–5 (pale → deep yellow on the figure). */
export const ENERGY_LABELS = ['', 'Pause nötig', 'müde', 'halb erholt', 'fast erholt', 'voll belastbar'];
export const WEEKLY_THRESHOLDS = [0.5, 4, 8, 12, 16];
const RECOVERED_BELOW = 2;

function bucket(value: number, thresholds: number[]): number {
  let level = 0;
  thresholds.forEach((t, i) => {
    if (value >= t) level = i + 1;
  });
  return level;
}

export function bodyWeightFor(data: AppData, settings: Settings): { kg: number; source: BodyAnalysis['bodyWeightSource'] } {
  const latest = [...data.health.weight].sort((a, b) => b.date.localeCompare(a.date))[0];
  if (latest) return { kg: latest.value, source: 'withings' };
  if (settings.training.bodyWeightKg) return { kg: settings.training.bodyWeightKg, source: 'manuell' };
  return { kg: settings.training.rankStandard === 'w' ? 62 : 72, source: 'schaetzung' };
}

function roundUp(kg: number, step: number): number {
  return Math.ceil(kg / step - 1e-9) * step;
}

function nextGoal(best: BestLift, rank: RankInfo, bodyWeight: number, sex: 'm' | 'w'): NextGoal | undefined {
  const target = levelFloor(rank.level + 1);
  const std = standardFor(best.exercise, sex);
  if (target === undefined || !std) return undefined;
  // A secondary lift only counts 70 %, so it has to be stronger.
  const needed = valueForScore(best.secondary ? target / SECONDARY_FACTOR : target, std.anchors);
  if (std.kind === 'ratio') {
    const reps = Math.min(Math.max(best.reps, 1), 15);
    const weight = roundUp((needed * bodyWeight) / (1 + (reps === 1 ? 0 : reps / 30)), best.weight % 1 ? 0.5 : 1);
    return { level: rank.level + 1, name: levelName(rank.level + 1), exercise: best.exercise, weight: Math.max(weight, best.weight + 0.5), reps };
  }
  return { level: rank.level + 1, name: levelName(rank.level + 1), exercise: best.exercise, reps: Math.max(Math.ceil(needed), best.reps + 1) };
}

export function analyzeBodyMuscles(data: AppData, settings: Settings, now = new Date()): BodyAnalysis {
  const { kg: bodyWeight, source } = bodyWeightFor(data, settings);
  const sex = settings.training.rankStandard;
  const perf = collectPerformances(data);
  const nowMs = now.getTime();
  const rankFrom = nowMs - RANK_WINDOW_DAYS * 86_400_000;
  const weekFrom = nowMs - 7 * 86_400_000;

  const muscles: MuscleStatus[] = BODY_MUSCLES.map((muscle) => {
    let best: BestLift | undefined;
    let load = 0;
    let weekly = 0;
    let last: string | undefined;
    for (const p of perf) {
      const role = p.exercise.muscles.indexOf(muscle);
      if (role < 0 || p.exercise.type === 'cardio') continue;
      const t = new Date(p.date).getTime();
      if (t > nowMs) continue;
      const credit = role === 0 ? 1 : 0.5;
      if (!last || p.date > last) last = p.date;
      if (t >= weekFrom) weekly += credit * p.sets;
      const hours = (nowMs - t) / 3_600_000;
      if (hours < 7 * 24) load += credit * p.sets * 0.5 ** (hours / HALF_LIFE_H);
      if (t < rankFrom) continue;
      const s = scoreSet(p.exercise, p.weight, p.reps, bodyWeight, sex);
      if (!s) continue;
      const score = role === 0 ? s.score : s.score * SECONDARY_FACTOR;
      if (!best || score > best.score) best = { exercise: p.exercise, weight: p.weight, reps: p.reps, date: p.date, score, value: s.value, kind: s.kind, secondary: role !== 0 };
    }
    const rank = best ? rankFromScore(best.score) : null;
    return {
      muscle,
      rank,
      best,
      next: best && rank ? nextGoal(best, rank, bodyWeight, sex) : undefined,
      load,
      loadLevel: bucket(load, LOAD_THRESHOLDS),
      energy: Math.round(100 * (1 - Math.min(load, LOAD_THRESHOLDS[4]) / LOAD_THRESHOLDS[4])),
      energyLevel: 5 - Math.min(4, bucket(load, LOAD_THRESHOLDS)),
      weeklySets: Math.round(weekly * 10) / 10,
      weeklyLevel: bucket(weekly, WEEKLY_THRESHOLDS),
      lastTrained: last,
      recoveredInH: load > RECOVERED_BELOW ? Math.ceil(HALF_LIFE_H * Math.log2(load / RECOVERED_BELOW)) : 0,
    };
  });

  const ranked = muscles.filter((m) => m.rank);
  // Untrained muscles count as zero: a balanced body ranks higher.
  const overall = ranked.length ? rankFromScore(muscles.reduce((s, m) => s + (m.rank?.score ?? 0), 0) / muscles.length) : null;

  return { bodyWeight, bodyWeightSource: source, standard: sex, muscles, overall, trainedCount: ranked.length, insights: bodyInsights(muscles) };
}

const LABEL: Record<MuscleGroup, string> = {
  brust: 'Brust',
  ruecken: 'Rücken',
  schultern: 'Schultern',
  bizeps: 'Bizeps',
  trizeps: 'Trizeps',
  beine: 'Beine',
  po: 'Po',
  beinbeuger: 'Beinbeuger',
  waden: 'Waden',
  core: 'Bauch',
  cardio: 'Ausdauer',
};

function list(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`;
}

function bodyInsights(muscles: MuscleStatus[]): string[] {
  const out: string[] = [];
  const by = (m: MuscleGroup) => muscles.find((x) => x.muscle === m)!;
  const tired = muscles.filter((m) => m.loadLevel >= 4).map((m) => LABEL[m.muscle]);
  if (tired.length) out.push(`${list(tired)} ${tired.length === 1 ? 'ist' : 'sind'} noch stark beansprucht – heute lieber andere Muskeln trainieren.`);
  const untrained = muscles.filter((m) => !m.lastTrained).map((m) => LABEL[m.muscle]);
  if (untrained.length && untrained.length < muscles.length) out.push(`Noch nicht trainiert: ${list(untrained)}. Erst damit zählt dein Gesamt-Rang voll.`);
  const low = muscles.filter((m) => m.lastTrained && m.weeklySets < 6).map((m) => LABEL[m.muscle]);
  if (low.length) out.push(`Wenig Sätze in den letzten 7 Tagen für ${list(low)} – für Muskelaufbau sind 10–20 Sätze pro Woche ideal.`);
  const push = Math.max(by('brust').rank?.score ?? 0, by('schultern').rank?.score ?? 0);
  const pull = by('ruecken').rank?.score ?? 0;
  if (push && pull && push - pull > 0.3) out.push('Brust/Schultern sind deutlich stärker als der Rücken – mehr Zugübungen (Rudern, Latzug) gleichen das aus und schonen die Schultern.');
  const upper = ['brust', 'ruecken', 'schultern'].map((m) => by(m as MuscleGroup).rank?.score ?? 0);
  const legs = by('beine').rank?.score ?? 0;
  if (legs && Math.max(...upper) - legs > 0.35) out.push('Die Beine hängen hinter dem Oberkörper zurück – Kniebeugen oder Beinpresse bringen sie nach vorne.');
  return out.slice(0, 3);
}
