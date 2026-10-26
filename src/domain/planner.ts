import { clamp, hashId } from '../lib/dates';
import { eventDurationMin } from './calendar';
import { availableExercises, MUSCLE_LABEL, type Exercise } from './exercises';
import type { ClassifiedEvent, MuscleGroup, TrainingGoal, WorkoutEntry } from './types';

export interface PlannedExercise {
  exercise: Exercise;
  sets: number;
  reps: string;
  restSec: number;
}

export interface TrainingPlan {
  title: string;
  focus: MuscleGroup[];
  focusLabel: string;
  durationMin: number;
  warmup: string;
  exercises: PlannedExercise[];
  cooldown: string;
  hints: string[];
}

const SCHEME: Record<TrainingGoal, { compound: [number, string, number]; isolation: [number, string, number] }> = {
  muskelaufbau: { compound: [4, '8–10', 120], isolation: [3, '10–12', 75] },
  kraft: { compound: [5, '4–6', 180], isolation: [3, '8–10', 90] },
  ausdauer: { compound: [3, '15–20', 60], isolation: [2, '15–20', 45] },
  fitness: { compound: [3, '10–12', 90], isolation: [3, '12–15', 60] },
};

/** Deterministic pseudo random generator so the same day gives the same plan. */
function rng(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function normalize(name: string): string {
  return name.toLocaleLowerCase('de-DE').replace(/[^a-zäöüß]/g, '');
}

/** Exercises done in the most recent workouts (e.g. from Liftoff) – used for variety. */
function recentlyDone(workouts: WorkoutEntry[]): Set<string> {
  const names = new Set<string>();
  const last = [...workouts].sort((a, b) => b.start.localeCompare(a.start)).slice(0, 2);
  for (const w of last) for (const e of w.exercises ?? []) names.add(normalize(e.name));
  return names;
}

export function planTraining(
  event: Pick<ClassifiedEvent, 'title' | 'start' | 'end' | 'focus'>,
  equipment: string[],
  goal: TrainingGoal,
  recentWorkouts: WorkoutEntry[] = [],
): TrainingPlan {
  const focus = event.focus?.length ? event.focus : (['beine', 'brust', 'ruecken', 'schultern', 'core'] as MuscleGroup[]);
  const duration = eventDurationMin(event as ClassifiedEvent) || 60;
  const pool = availableExercises(equipment);
  const random = rng(hashId(event.start + event.title));
  const recent = recentlyDone(recentWorkouts);
  const hints: string[] = [];

  const cardioOnly = focus.length === 1 && focus[0] === 'cardio';
  const cardioPool = pool.filter((e) => e.type === 'cardio');
  const warmupEx = cardioPool.find((e) => e.id !== 'burpees') ?? cardioPool[0];
  const warmup = cardioOnly
    ? 'Mobilisation: Arm- und Hüftkreisen, 5 min locker einrollen.'
    : `${warmupEx ? `5–8 min ${warmupEx.name} locker` : '5 min Hampelmänner & Seilspringen-Imitation'}, danach 1–2 leichte Aufwärmsätze der ersten Übung.`;

  // Score candidates: prefer exercises not done last time, then a little randomness.
  const score = (e: Exercise) => (recent.has(normalize(e.name)) ? 0 : 1) + random() * 0.5;
  const pick = (candidates: Exercise[], taken: Set<string>): Exercise | undefined =>
    candidates
      .filter((e) => !taken.has(e.id))
      .map((e) => ({ e, s: score(e) }))
      .sort((a, b) => b.s - a.s)[0]?.e;

  const scheme = SCHEME[goal];
  const chosen: PlannedExercise[] = [];
  const taken = new Set<string>();
  const add = (e: Exercise) => {
    taken.add(e.id);
    const [sets, reps, restSec] = e.type === 'compound' ? scheme.compound : scheme.isolation;
    chosen.push({ exercise: e, sets, reps, restSec });
  };

  if (cardioOnly) {
    const target = clamp(Math.round(duration / 15), 2, 4);
    for (let i = 0; i < target; i++) {
      const e = pick(pool.filter((p) => p.muscles.includes('cardio')), taken);
      if (!e) break;
      taken.add(e.id);
      chosen.push({ exercise: e, sets: 1, reps: `${Math.round((duration - 10) / target)} min`, restSec: 120 });
    }
  } else {
    const target = clamp(Math.round((duration - 10) / 9), 3, 8);
    const strength = focus.filter((g) => g !== 'cardio');
    // 1) One compound per focus group (main target first).
    for (const g of strength) {
      if (chosen.length >= target) break;
      const e =
        pick(pool.filter((p) => p.type === 'compound' && p.muscles[0] === g), taken) ??
        pick(pool.filter((p) => p.type === 'compound' && p.muscles.includes(g)), taken);
      if (e) add(e);
    }
    // 2) Fill with isolation / remaining exercises round robin over the groups.
    let guard = 0;
    while (chosen.length < target && guard++ < 50) {
      let added = false;
      for (const g of strength) {
        if (chosen.length >= target) break;
        const e =
          pick(pool.filter((p) => p.type === 'isolation' && p.muscles[0] === g), taken) ??
          pick(pool.filter((p) => p.type !== 'cardio' && p.muscles.includes(g)), taken);
        if (e) {
          add(e);
          added = true;
        }
      }
      if (!added) break;
    }
    if (focus.includes('cardio')) {
      const e = pick(cardioPool, taken);
      if (e) chosen.push({ exercise: e, sets: 1, reps: '10–15 min', restSec: 0 });
    }
    const missing = strength.filter((g) => !chosen.some((c) => c.exercise.muscles.includes(g)));
    if (missing.length) {
      hints.push(`Für ${missing.map((m) => MUSCLE_LABEL[m]).join(', ')} wurde mit deiner Ausstattung keine passende Übung gefunden.`);
    }
  }

  if (equipment.length === 0) {
    hints.push('Noch keine Geräte ausgewählt – der Plan nutzt nur Körpergewichtsübungen. Wähle unter „Meine Geräte“ aus, was du hast.');
  }
  if (goal === 'muskelaufbau') hints.push('Steigere das Gewicht, sobald du alle Sätze am oberen Ende der Wiederholungen schaffst.');

  return {
    title: event.title,
    focus,
    focusLabel: focus.map((f) => MUSCLE_LABEL[f]).join(' · '),
    durationMin: duration,
    warmup,
    exercises: chosen,
    cooldown: '5 min Dehnen der trainierten Muskeln, ggf. Faszienrolle.',
    hints,
  };
}
