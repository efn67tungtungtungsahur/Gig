// Training logged in the app: exercises, sets, weight and reps.

import { EXERCISES } from './exercises';
import type { TrainingPlan } from './planner';
import type { LoggedExercise, LoggedSet, LoggedWorkout, WorkoutEntry } from './types';

export function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Stable key of an exercise across workouts (catalogue id, else the normalised name). */
export function exerciseKey(e: { exerciseId?: string; name: string }): string {
  return e.exerciseId ?? `name:${e.name.trim().toLocaleLowerCase('de-DE')}`;
}

export function doneSets(e: LoggedExercise): LoggedSet[] {
  return e.sets.filter((s) => s.done && (s.reps ?? 0) > 0);
}

/** Epley estimate of the one-rep max. */
export function estimated1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function exerciseVolume(e: LoggedExercise): number {
  return doneSets(e).reduce((s, set) => s + (set.weight ?? 0) * (set.reps ?? 0), 0);
}

export function workoutVolume(w: LoggedWorkout): number {
  return w.exercises.reduce((s, e) => s + exerciseVolume(e), 0);
}

export function workoutSetCount(w: LoggedWorkout): number {
  return w.exercises.reduce((s, e) => s + doneSets(e).length, 0);
}

export function workoutDurationMin(w: LoggedWorkout, now = new Date()): number {
  const end = w.end ? new Date(w.end) : now;
  return Math.max(0, Math.round((end.getTime() - new Date(w.start).getTime()) / 60000));
}

/** "1,2 t" / "850 kg" */
export function formatVolume(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1).replace('.', ',')} t` : `${Math.round(kg)} kg`;
}

export function formatKg(kg: number | null | undefined): string {
  if (kg === null || kg === undefined) return '–';
  return `${Number.isInteger(kg) ? kg : kg.toFixed(1).replace('.', ',')} kg`;
}

/** The sets of an exercise the last time it was done (in a finished workout). */
export function lastPerformance(log: LoggedWorkout[], key: string, beforeStart?: string): LoggedSet[] | undefined {
  const finished = log
    .filter((w) => w.end && (!beforeStart || w.start < beforeStart))
    .sort((a, b) => b.start.localeCompare(a.start));
  for (const w of finished) {
    const e = w.exercises.find((x) => exerciseKey(x) === key);
    if (e && doneSets(e).length) return doneSets(e);
  }
  return undefined;
}

/** Upper end of a rep target like "8–10" or "12". */
export function upperReps(target?: string): number | undefined {
  if (!target) return undefined;
  const nums = target.match(/\d+/g)?.map(Number) ?? [];
  return nums.length ? Math.max(...nums) : undefined;
}

/**
 * Progressive overload: when every set last time reached the top of the rep
 * range, suggest a bit more weight; otherwise repeat the weight.
 */
export function suggestWeight(last: LoggedSet[] | undefined, targetReps?: string, increment = 2.5): number | undefined {
  if (!last?.length) return undefined;
  const top = Math.max(...last.map((s) => s.weight ?? 0));
  if (top <= 0) return undefined;
  const upper = upperReps(targetReps);
  const topSets = last.filter((s) => (s.weight ?? 0) === top);
  const allHit = upper !== undefined && topSets.every((s) => (s.reps ?? 0) >= upper);
  return allHit ? top + increment : top;
}

export interface ExerciseRecord {
  key: string;
  name: string;
  maxWeight: number;
  best1RM: number;
  sessions: number;
}

/** Best values per exercise across finished workouts (optionally excluding one). */
export function personalRecords(log: LoggedWorkout[], excludeId?: string): Map<string, ExerciseRecord> {
  const out = new Map<string, ExerciseRecord>();
  for (const w of log) {
    if (!w.end || w.id === excludeId) continue;
    for (const e of w.exercises) {
      const sets = doneSets(e);
      if (!sets.length) continue;
      const key = exerciseKey(e);
      const rec = out.get(key) ?? { key, name: e.name, maxWeight: 0, best1RM: 0, sessions: 0 };
      rec.sessions++;
      for (const s of sets) {
        rec.maxWeight = Math.max(rec.maxWeight, s.weight ?? 0);
        rec.best1RM = Math.max(rec.best1RM, estimated1RM(s.weight ?? 0, s.reps ?? 0));
      }
      out.set(key, rec);
    }
  }
  return out;
}

export interface NewRecord {
  name: string;
  kind: 'gewicht' | '1rm';
  value: number;
  previous: number;
}

/** Records broken by this workout compared to all earlier ones. */
export function newRecords(workout: LoggedWorkout, log: LoggedWorkout[]): NewRecord[] {
  const before = personalRecords(log.filter((w) => w.start < workout.start), workout.id);
  const out: NewRecord[] = [];
  for (const e of workout.exercises) {
    const sets = doneSets(e);
    const prev = before.get(exerciseKey(e));
    if (!sets.length || !prev) continue; // first time is not a record
    const maxW = Math.max(...sets.map((s) => s.weight ?? 0));
    const best = Math.max(...sets.map((s) => estimated1RM(s.weight ?? 0, s.reps ?? 0)));
    if (maxW > prev.maxWeight) out.push({ name: e.name, kind: 'gewicht', value: maxW, previous: prev.maxWeight });
    else if (best > prev.best1RM + 0.01) out.push({ name: e.name, kind: '1rm', value: best, previous: prev.best1RM });
  }
  return out;
}

export interface HistoryPoint {
  date: string;
  topWeight: number;
  best1RM: number;
  volume: number;
  sets: LoggedSet[];
}

export function exerciseHistory(log: LoggedWorkout[], key: string): HistoryPoint[] {
  return log
    .filter((w) => w.end)
    .sort((a, b) => a.start.localeCompare(b.start))
    .flatMap((w) => {
      const e = w.exercises.find((x) => exerciseKey(x) === key);
      const sets = e ? doneSets(e) : [];
      if (!e || !sets.length) return [];
      return [
        {
          date: w.start,
          topWeight: Math.max(...sets.map((s) => s.weight ?? 0)),
          best1RM: Math.max(...sets.map((s) => estimated1RM(s.weight ?? 0, s.reps ?? 0))),
          volume: exerciseVolume(e),
          sets,
        },
      ];
    });
}

/** A new workout, prefilled from a training plan with suggested weights. */
export function workoutFromPlan(plan: TrainingPlan | null, log: LoggedWorkout[], opts: { title: string; eventId?: string; now?: Date }): LoggedWorkout {
  const now = opts.now ?? new Date();
  const exercises: LoggedExercise[] = (plan?.exercises ?? []).map((p) => {
    const key = p.exercise.id;
    const last = lastPerformance(log, key);
    const weight = suggestWeight(last, p.reps) ?? null;
    const lastReps = last?.[0]?.reps ?? null;
    return {
      id: newId('x'),
      exerciseId: p.exercise.id,
      name: p.exercise.name,
      targetSets: p.sets,
      targetReps: p.reps,
      restSec: p.restSec,
      sets: Array.from({ length: Math.max(1, p.sets) }, () => ({ weight, reps: /\d+\s*min/.test(p.reps) ? null : lastReps, done: false })),
    };
  });
  return { id: newId('w'), start: now.toISOString(), title: opts.title, eventId: opts.eventId, exercises };
}

/** Adds an exercise (from the catalogue or a free name) to a workout. */
export function addExercise(w: LoggedWorkout, entry: { exerciseId?: string; name: string }, log: LoggedWorkout[]): LoggedWorkout {
  const key = exerciseKey(entry);
  const last = lastPerformance(log, key);
  const previous = log
    .filter((x) => x.end)
    .sort((a, b) => b.start.localeCompare(a.start))
    .flatMap((x) => x.exercises)
    .find((e) => exerciseKey(e) === key && doneSets(e).length);
  const catalogue = entry.exerciseId ? EXERCISES.find((e) => e.id === entry.exerciseId) : undefined;
  const isolation = catalogue?.type === 'isolation';
  const targetReps = previous?.targetReps ?? (catalogue ? (isolation ? '10–12' : '8–10') : undefined);
  const weight = suggestWeight(last, targetReps) ?? null;
  const sets = last?.length ? last.map((s) => ({ weight, reps: s.reps, done: false })) : [{ weight: null, reps: null, done: false }];
  return {
    ...w,
    exercises: [
      ...w.exercises,
      {
        id: newId('x'),
        exerciseId: entry.exerciseId,
        name: catalogue?.name ?? entry.name.trim(),
        targetSets: previous?.targetSets ?? (last?.length || undefined),
        targetReps,
        restSec: previous?.restSec ?? (isolation ? 75 : 120),
        sets,
      },
    ],
  };
}

/** Converts a logged workout for the shared statistics (streak, report, planner). */
export function toWorkoutEntry(w: LoggedWorkout): WorkoutEntry {
  const end = w.end ?? w.start;
  return {
    start: w.start,
    end,
    type: 'strength',
    durationMin: workoutDurationMin(w, new Date(end)),
    source: 'Gig Fit',
    title: w.title,
    exercises: w.exercises
      .filter((e) => doneSets(e).length)
      .map((e) => {
        const sets = doneSets(e);
        return {
          name: e.name,
          sets: sets.length,
          bestWeight: Math.max(...sets.map((s) => s.weight ?? 0)) || undefined,
          reps: Math.max(...sets.map((s) => s.reps ?? 0)) || undefined,
        };
      }),
  };
}
