import { describe, expect, it } from 'vitest';
import { computeBadges, mergeActivity } from '../src/domain/badges';
import { emptyData } from '../src/domain/defaults';
import { demoData } from '../src/integrations/demo';

const run = (start: string, km?: number) => ({ start, end: start, type: 'running', durationMin: 40, distanceKm: km });

describe('activity badges', () => {
  it('keeps the best value per day and every run in the archive', () => {
    const a = mergeActivity(undefined, { steps: [{ date: '2026-10-01', value: 8000 }], distance: [{ date: '2026-10-01', value: 6 }], workouts: [run('2026-10-01T07:00:00Z', 5.2)] });
    const b = mergeActivity(a, { steps: [{ date: '2026-10-01', value: 7000 }, { date: '2026-10-02', value: 12000 }], distance: [], workouts: [{ ...run('2026-10-02T07:00:00Z'), type: 'walking' }] });
    expect(b.days['2026-10-01']).toEqual({ steps: 8000, km: 6 });
    expect(b.days['2026-10-02'].steps).toBe(12000);
    expect(b.runs).toHaveLength(1);
  });

  it('awards daily step, distance and run badges', () => {
    const data = emptyData();
    data.health.steps = [
      { date: '2026-10-01', value: 10400 },
      { date: '2026-10-02', value: 16000 },
      { date: '2026-10-03', value: 4000 },
    ];
    data.health.distance = [{ date: '2026-10-01', value: 30 }, { date: '2026-10-02', value: 14 }];
    data.health.workouts = [run('2026-10-01T07:00:00Z', 5.3), run('2026-10-02T07:00:00Z', 10.4)];
    const s = computeBadges(data);
    const b = (id: string) => s.badges.find((x) => x.id === id)!;
    expect(b('schritte-10000')).toMatchObject({ earned: true, count: 2, firstDate: '2026-10-01' });
    expect(b('schritte-20000').earned).toBe(false);
    expect(b('schritte-20000').progress).toBeCloseTo(0.8);
    // 30 + 14 + 4000 steps × 0.74 m ≈ 47 km → Marathon on day 2
    expect(s.lifetimeKm).toBeCloseTo(46.96, 1);
    expect(s.estimated).toBe(true);
    expect(b('strecke-42')).toMatchObject({ earned: true, firstDate: '2026-10-02' });
    expect(b('laufen-erster').earned).toBe(true);
    expect(b('laufen-10k')).toMatchObject({ earned: true, firstDate: '2026-10-02' });
    expect(b('laufen-halb').earned).toBe(false);
    expect(s.next).toBeDefined();
  });

  it('gives the demo a year of badges', () => {
    const s = computeBadges(demoData(new Date(2026, 9, 26, 12)));
    expect(s.earned).toBeGreaterThan(8);
    expect(s.lifetimeKm).toBeGreaterThan(1000);
    expect(s.runs).toBeGreaterThanOrEqual(10);
  });
});
