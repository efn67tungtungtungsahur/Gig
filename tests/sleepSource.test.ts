import { describe, expect, it } from 'vitest';
import { mainNights, sleepSourceCounts } from '../src/domain/sleep';
import type { SleepNight } from '../src/domain/types';

const night = (date: string, minutesAsleep: number, source: string): SleepNight => ({
  date,
  start: `${date}T00:00:00Z`,
  end: `${date}T07:00:00Z`,
  minutesInBed: minutesAsleep + 30,
  minutesAsleep,
  source,
});

describe('sleep sources', () => {
  const sessions = [
    night('2026-10-20', 430, 'Fitbit'),
    night('2026-10-20', 410, 'Withings'),
    night('2026-10-21', 400, 'Fitbit'),
    night('2026-10-22', 390, 'Withings'),
    night('2026-10-22', 60, 'Withings'), // nap
  ];

  it('takes the longest sleep automatically', () => {
    expect(mainNights(sessions).map((n) => n.source)).toEqual(['Fitbit', 'Fitbit', 'Withings']);
  });

  it('prefers the chosen source when it recorded the night', () => {
    const n = mainNights(sessions, 'Withings');
    expect(n.map((x) => [x.date, x.source])).toEqual([
      ['2026-10-20', 'Withings'],
      ['2026-10-21', 'Fitbit'], // Withings has no data that night
      ['2026-10-22', 'Withings'],
    ]);
    expect(n[2].minutesAsleep).toBe(390); // the nap never replaces the night
  });

  it('counts nights per source without naps', () => {
    expect(sleepSourceCounts(sessions)).toEqual([
      { source: 'Fitbit', nights: 2 },
      { source: 'Withings', nights: 2 },
    ]);
  });
});
