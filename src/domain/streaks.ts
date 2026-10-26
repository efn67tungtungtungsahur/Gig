import { dayKey, daysBetween } from '../lib/dates';
import { eventDayKey } from './calendar';
import type { ClassifiedEvent, TrainingLog, WorkoutEntry } from './types';

export type TrainingStatus = 'done' | 'missed' | 'skipped' | 'pending';

export interface TrainingSession {
  event: ClassifiedEvent;
  status: TrainingStatus;
  /** True when the status comes from a recorded workout (Health Connect/Liftoff). */
  auto: boolean;
}

export interface TrainingStreak {
  current: number;
  best: number;
  /** Planned trainings from the calendar, newest first (past and today). */
  sessions: TrainingSession[];
  next?: ClassifiedEvent;
}

/**
 * Status of a planned training: marked by hand, or done when a workout was
 * recorded that day. Past trainings without a workout count as missed; today's
 * stay open until the day is over. Cancelled ones ("abgesagt") are ignored.
 */
export function sessionStatus(ev: ClassifiedEvent, workouts: WorkoutEntry[], log: TrainingLog, now: Date): { status: TrainingStatus; auto: boolean } {
  const manual = log[ev.id];
  if (manual) return { status: manual, auto: false };
  const day = eventDayKey(ev);
  if (workouts.some((w) => dayKey(new Date(w.start)) === day)) return { status: 'done', auto: true };
  return { status: daysBetween(day, dayKey(now)) > 0 ? 'missed' : 'pending', auto: false };
}

/**
 * Trainings in a row that were done as planned. Days without a planned training
 * never break the streak – only a missed appointment does.
 */
export function trainingStreak(events: ClassifiedEvent[], workouts: WorkoutEntry[], log: TrainingLog, now = new Date(), historyDays = 120): TrainingStreak {
  const todayKey = dayKey(now);
  const planned = events
    .filter((e) => e.kind === 'training')
    .filter((e) => {
      const diff = daysBetween(eventDayKey(e), todayKey);
      return diff >= 0 && diff <= historyDays && new Date(e.start) <= now;
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  const sessions = planned.map((event) => ({ event, ...sessionStatus(event, workouts, log, now) }));
  let run = 0;
  let best = 0;
  for (const s of sessions) {
    if (s.status === 'done') {
      run++;
      best = Math.max(best, run);
    } else if (s.status === 'missed') {
      run = 0;
    }
  }
  const next = events
    .filter((e) => e.kind === 'training' && new Date(e.start) > now)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  return { current: run, best, sessions: [...sessions].reverse(), next };
}
