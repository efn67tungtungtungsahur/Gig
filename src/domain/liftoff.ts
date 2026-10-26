import { dayKey, daysBetween } from '../lib/dates';
import type { LiftoffData, LiftoffSnapshot, WorkoutEntry } from './types';

export interface LiftoffSummary {
  latest?: LiftoffSnapshot;
  previous?: LiftoffSnapshot;
  /** Positive = moved up in the ranking. */
  positionChange?: number;
  xpChange?: number;
  unlockedCount: number;
  totalAchievements: number;
  newAchievements: string[];
  workoutsLast7: number;
  workoutsLast28: number;
}

export function latestSnapshot(data: LiftoffData): LiftoffSnapshot | undefined {
  return [...data.snapshots].sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function summarizeLiftoff(data: LiftoffData, allWorkouts: WorkoutEntry[], today = new Date()): LiftoffSummary {
  const sorted = [...data.snapshots].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];
  const previous = sorted.find((s) => latest && s.date < latest.date && s.position !== undefined) ?? sorted[1];
  const unlocked = latest?.achievements.filter((a) => a.unlocked) ?? [];
  const prevUnlocked = new Set(previous?.achievements.filter((a) => a.unlocked).map((a) => a.name) ?? []);
  const todayKey = dayKey(today);
  const count = (days: number) =>
    allWorkouts.filter((w) => {
      const diff = daysBetween(dayKey(new Date(w.start)), todayKey);
      return diff >= 0 && diff < days;
    }).length;

  return {
    latest,
    previous,
    positionChange:
      latest?.position !== undefined && previous?.position !== undefined ? previous.position - latest.position : undefined,
    xpChange: latest?.xp !== undefined && previous?.xp !== undefined ? latest.xp - previous.xp : undefined,
    unlockedCount: unlocked.length,
    totalAchievements: latest?.achievements.length ?? 0,
    newAchievements: previous ? unlocked.filter((a) => !prevUnlocked.has(a.name)).map((a) => a.name) : [],
    workoutsLast7: count(7),
    workoutsLast28: count(28),
  };
}

/** Parses Liftoff's "01 hours 06 minutes 01 seconds" into minutes. */
export function parseLiftoffDuration(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2 || parts.length % 2 !== 0) return undefined;
  let seconds = 0;
  for (let i = 0; i < parts.length; i += 2) {
    const n = Number(parts[i]);
    if (!Number.isFinite(n)) return undefined;
    const unit = parts[i + 1].toLowerCase().replace(/s$/, '');
    if (unit === 'hour') seconds += n * 3600;
    else if (unit === 'minute' || unit === 'min') seconds += n * 60;
    else if (unit === 'second' || unit === 'sec') seconds += n;
    else return undefined;
  }
  return Math.round(seconds / 60);
}

interface LiftoffPost {
  id?: string;
  startedAt?: string;
  postedAt?: string;
  sessionDuration?: string;
  sessionNotes?: string;
  caloriesBurned?: number;
  exerciseData?: {
    exerciseName?: string;
    setsData?: { inputOne?: number | string; inputTwo?: number | string; setType?: string }[];
  }[];
}

/** Converts posts from Liftoff's API into workout entries. */
export function postsToWorkouts(posts: unknown): WorkoutEntry[] {
  if (!Array.isArray(posts)) return [];
  const out: WorkoutEntry[] = [];
  for (const raw of posts as LiftoffPost[]) {
    const start = raw.startedAt ?? raw.postedAt;
    if (!start || Number.isNaN(new Date(start).getTime())) continue;
    const durationMin = parseLiftoffDuration(raw.sessionDuration) ?? 60;
    const end = new Date(new Date(start).getTime() + durationMin * 60_000).toISOString();
    out.push({
      start: new Date(start).toISOString(),
      end,
      type: 'strength',
      durationMin,
      calories: raw.caloriesBurned || undefined,
      source: 'Liftoff',
      title: raw.sessionNotes?.split('\n')[0]?.slice(0, 60) || 'Liftoff-Workout',
      exercises: (raw.exerciseData ?? []).map((e) => {
        const sets = e.setsData ?? [];
        const weights = sets.map((s) => Number(s.inputOne)).filter((n) => Number.isFinite(n) && n > 0);
        const reps = sets.map((s) => Number(s.inputTwo)).filter((n) => Number.isFinite(n) && n > 0);
        return {
          name: e.exerciseName ?? 'Übung',
          sets: sets.length,
          bestWeight: weights.length ? Math.max(...weights) : undefined,
          reps: reps.length ? Math.max(...reps) : undefined,
        };
      }),
    });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
