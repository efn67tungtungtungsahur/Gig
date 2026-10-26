import { describe, expect, it } from 'vitest';
import { analyzeBodyMuscles, findExercise, rankFromScore, scoreSet } from '../src/domain/body';
import { defaultSettings, emptyData } from '../src/domain/defaults';
import { EXERCISES } from '../src/domain/exercises';
import type { LoggedWorkout } from '../src/domain/types';
import { demoData } from '../src/integrations/demo';

const ex = (id: string) => EXERCISES.find((e) => e.id === id)!;

function workout(start: Date, exercises: [string, number, number, number][]): LoggedWorkout {
  return {
    id: start.toISOString(),
    start: start.toISOString(),
    end: new Date(start.getTime() + 3600_000).toISOString(),
    title: 'Gym',
    exercises: exercises.map(([id, weight, reps, sets]) => ({
      id,
      exerciseId: id,
      name: ex(id).name,
      sets: Array.from({ length: sets }, () => ({ weight, reps, done: true })),
    })),
  };
}

describe('muscle ranks', () => {
  it('maps scores to 15 levels from Bronze III to Diamant I', () => {
    expect(rankFromScore(0).name).toBe('Bronze III');
    expect(rankFromScore(0.5).name).toBe('Silber III');
    expect(rankFromScore(1.0).name).toBe('Platin III');
    expect(rankFromScore(1.05).progress).toBeCloseTo(0.05 / 0.12);
    expect(rankFromScore(3).name).toBe('Diamant I');
    expect(rankFromScore(3).progress).toBe(1);
  });

  it('scores lifts against body weight standards', () => {
    // 80 kg, bench 1RM = 96 kg (1.2 × BW) → exactly intermediate = Platin III
    expect(scoreSet(ex('bankdruecken'), 96, 1, 80, 'm')?.score).toBeCloseTo(1.0);
    // Same lift by the female standard ranks much higher
    expect(scoreSet(ex('bankdruecken'), 96, 1, 80, 'w')!.score).toBeGreaterThan(1.5);
    // 13 pull-ups = intermediate; added weight counts as extra reps
    expect(scoreSet(ex('klimmzuege'), 0, 13, 80, 'm')?.score).toBeCloseTo(1.0);
    expect(scoreSet(ex('klimmzuege'), 10, 8, 80, 'm')!.value).toBeGreaterThan(8);
    // Bands have no standard
    expect(scoreSet(ex('band_curls'), 10, 12, 80, 'm')).toBeUndefined();
  });

  it('matches German and English exercise names', () => {
    expect(findExercise({ name: 'Bench Press' })?.id).toBe('bankdruecken');
    expect(findExercise({ name: 'Lat Pulldowns' })?.id).toBe('latzug');
    expect(findExercise({ name: 'Kniebeugen (Langhantel)' })?.id).toBe('kniebeuge');
    expect(findExercise({ name: 'Irgendwas' })).toBeUndefined();
  });

  it('builds ranks, load and weekly sets per muscle', () => {
    const now = new Date(2026, 9, 26, 12);
    const settings = defaultSettings(now);
    const data = emptyData();
    data.health.weight = [{ date: new Date(2026, 9, 20).toISOString(), value: 80 }];
    data.workoutLog = [
      workout(new Date(2026, 9, 25, 17), [
        ['bankdruecken', 80, 5, 4],
        ['seitheben', 10, 12, 3],
      ]),
      workout(new Date(2026, 9, 22, 17), [['kniebeuge', 100, 5, 4]]),
    ];
    const a = analyzeBodyMuscles(data, settings, now);
    const brust = a.muscles.find((m) => m.muscle === 'brust')!;
    expect(a.bodyWeightSource).toBe('withings');
    expect(brust.rank?.name).toMatch(/^Gold|^Platin/);
    expect(brust.weeklySets).toBe(4);
    expect(brust.loadLevel).toBeGreaterThanOrEqual(2); // yesterday
    expect(brust.recoveredInH).toBeGreaterThan(0);
    expect(brust.next?.exercise.id).toBe('bankdruecken');
    expect(brust.next!.weight).toBeGreaterThan(80);
    // Bench press also works the triceps (secondary, half the sets)
    expect(a.muscles.find((m) => m.muscle === 'trizeps')!.weeklySets).toBe(2);
    // Legs: four days ago → mostly recovered
    expect(a.muscles.find((m) => m.muscle === 'beine')!.loadLevel).toBeLessThanOrEqual(1);
    expect(a.muscles.find((m) => m.muscle === 'waden')!.rank).toBeNull();
    expect(a.overall).not.toBeNull();
    expect(a.trainedCount).toBeGreaterThanOrEqual(5);
  });

  it('uses Liftoff exercises when nothing was logged in the app', () => {
    const now = new Date(2026, 9, 26, 12);
    const data = emptyData();
    data.liftoff.workouts = [
      { start: new Date(2026, 9, 24, 17).toISOString(), end: new Date(2026, 9, 24, 18).toISOString(), type: 'strength', durationMin: 60, exercises: [{ name: 'Deadlift', sets: 3, bestWeight: 120, reps: 5 }] },
    ];
    const a = analyzeBodyMuscles(data, defaultSettings(now), now);
    expect(a.bodyWeightSource).toBe('schaetzung');
    expect(a.muscles.find((m) => m.muscle === 'ruecken')!.best?.exercise.id).toBe('kreuzheben');
    expect(a.muscles.find((m) => m.muscle === 'po')!.best?.secondary).toBe(true);
  });

  it('gives the demo a plausible body overview', () => {
    const now = new Date(2026, 9, 26, 12);
    const a = analyzeBodyMuscles(demoData(now), defaultSettings(now), now);
    expect(a.trainedCount).toBeGreaterThanOrEqual(7);
    expect(a.insights.length).toBeGreaterThan(0);
  });
});
