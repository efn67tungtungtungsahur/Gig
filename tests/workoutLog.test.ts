import { describe, expect, it } from 'vitest';
import { classifyAll } from '../src/domain/calendar';
import { defaultSettings, emptyData } from '../src/domain/defaults';
import { planTraining } from '../src/domain/planner';
import { buildReport } from '../src/domain/report';
import { demoData } from '../src/integrations/demo';
import type { CalEvent, LoggedWorkout } from '../src/domain/types';
import {
  addExercise,
  estimated1RM,
  exerciseHistory,
  lastPerformance,
  newRecords,
  suggestWeight,
  workoutFromPlan,
  workoutSetCount,
  workoutVolume,
} from '../src/domain/workoutLog';

const set = (weight: number, reps: number, done = true) => ({ weight, reps, done });

function workout(id: string, start: string, exercises: LoggedWorkout['exercises'], end = true): LoggedWorkout {
  return { id, start, end: end ? new Date(new Date(start).getTime() + 3600_000).toISOString() : undefined, title: 'Gym Push', exercises };
}

const bench = (sets: ReturnType<typeof set>[]) => ({ id: 'b', exerciseId: 'kh_bankdruecken', name: 'Kurzhantel-Bankdrücken', sets });

describe('workout log', () => {
  it('demo data shows steady progress', () => {
    const demo = demoData(new Date(2026, 9, 26, 12));
    const h = exerciseHistory(demo.workoutLog, 'kh_bankdruecken');
    expect(h.length).toBeGreaterThan(2);
    expect(h.every((p, i) => i === 0 || p.topWeight >= h[i - 1].topWeight)).toBe(true);
  });

  const w1 = workout('w1', '2026-10-12T15:00:00.000Z', [bench([set(24, 10), set(24, 10), set(24, 10), set(24, 9, false)])]);
  const w2 = workout('w2', '2026-10-19T15:00:00.000Z', [bench([set(26, 9), set(26, 8), set(26, 8)])]);
  const log = [w1, w2];

  it('sums volume and counts only completed sets', () => {
    expect(workoutVolume(w1)).toBe(720);
    expect(workoutSetCount(w1)).toBe(3);
  });

  it('remembers the last performance of an exercise', () => {
    expect(lastPerformance(log, 'kh_bankdruecken')?.map((s) => s.weight)).toEqual([26, 26, 26]);
    expect(lastPerformance(log, 'kh_bankdruecken', w2.start)?.map((s) => s.weight)).toEqual([24, 24, 24]);
  });

  it('suggests more weight only when all sets hit the top of the rep range', () => {
    expect(suggestWeight(lastPerformance(log, 'kh_bankdruecken', w2.start), '8–10')).toBe(26.5);
    expect(suggestWeight(lastPerformance(log, 'kh_bankdruecken'), '8–10')).toBe(26);
    expect(suggestWeight(undefined, '8–10')).toBeUndefined();
  });

  it('detects new records against earlier workouts', () => {
    expect(newRecords(w2, log)).toEqual([{ name: 'Kurzhantel-Bankdrücken', kind: 'gewicht', value: 26, previous: 24 }]);
    expect(newRecords(w1, log)).toEqual([]); // first time is not a record
    expect(estimated1RM(100, 1)).toBe(100);
    expect(Math.round(estimated1RM(80, 10))).toBe(107);
  });

  it('builds the progress history per exercise', () => {
    const h = exerciseHistory(log, 'kh_bankdruecken');
    expect(h.map((p) => p.topWeight)).toEqual([24, 26]);
  });

  it('starts a workout from the training plan with suggested weights', () => {
    const plan = planTraining(
      { title: 'Gym Push', start: '2026-10-26T16:00:00.000Z', end: '2026-10-26T17:00:00.000Z', focus: ['brust', 'schultern', 'trizeps'] },
      ['dumbbells', 'bench'],
      'muskelaufbau',
    );
    const w = workoutFromPlan(plan, log, { title: 'Gym Push', eventId: 'ev1', now: new Date('2026-10-26T16:00:00.000Z') });
    expect(w.eventId).toBe('ev1');
    expect(w.exercises.length).toBe(plan.exercises.length);
    const kh = w.exercises.find((e) => e.exerciseId === 'kh_bankdruecken');
    if (kh) {
      expect(kh.sets).toHaveLength(kh.targetSets!);
      expect(kh.sets[0].weight).toBe(26);
    }
    // Added later: same progression as from the plan (all 10 reps hit → +2.5 kg).
    const added = addExercise({ ...w, exercises: [] }, { exerciseId: 'kh_bankdruecken', name: 'Kurzhantel-Bankdrücken' }, [w1]);
    expect(added.exercises[0]).toMatchObject({ targetReps: '8–10', targetSets: 3 });
    expect(added.exercises[0].sets.map((s) => s.weight)).toEqual([26.5, 26.5, 26.5]);
    const withCustom = addExercise(w, { name: 'Landmine Press' }, log);
    expect(withCustom.exercises.at(-1)).toMatchObject({ name: 'Landmine Press', sets: [{ weight: null, reps: null, done: false }] });
  });

  it('counts a logged workout for the training streak and the report', () => {
    const now = new Date(2026, 9, 26, 20);
    const settings = defaultSettings(now);
    const data = emptyData();
    const ev: CalEvent = { id: 'ev1', uid: 'ev1', title: 'Gym Push', start: new Date(2026, 9, 26, 17).toISOString(), end: new Date(2026, 9, 26, 18).toISOString(), allDay: false };
    data.calendar.events = [ev];
    data.workoutLog = [workout('w3', new Date(2026, 9, 26, 17).toISOString(), [bench([set(26, 10), set(26, 10)])])];
    const r = buildReport(data, settings, now);
    expect(r.trainingStreak.current).toBe(1);
    expect(r.trainingStreak.sessions[0]).toMatchObject({ status: 'done', auto: true });
    expect(r.training.workouts[0].source).toBe('Gig Fit');
    expect(classifyAll([ev], settings.keywords)[0].kind).toBe('training');
  });
});
