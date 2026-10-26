import { describe, expect, it } from 'vitest';
import { defaultSettings, mergeSettings } from '../src/domain/defaults';
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

  it('uses only the chosen source and ignores Fitbit completely', () => {
    const n = mainNights(sessions, 'Withings');
    expect(n.map((x) => [x.date, x.source, x.minutesAsleep])).toEqual([
      ['2026-10-20', 'Withings', 410],
      ['2026-10-22', 'Withings', 390],
    ]);
  });

  it('takes the longest sleep of all sources with "alle"', () => {
    expect(mainNights(sessions, 'alle').map((n) => n.source)).toEqual(['Fitbit', 'Fitbit', 'Withings']);
  });

  it('counts nights per source without naps', () => {
    expect(sleepSourceCounts(sessions)).toEqual([
      { source: 'Fitbit', nights: 2 },
      { source: 'Withings', nights: 2 },
    ]);
  });

  it('defaults to Withings, also for the earlier "auto" setting', () => {
    expect(defaultSettings().sleep.source).toBe('Withings');
    const old = { ...defaultSettings(), sleep: { ...defaultSettings().sleep, source: 'auto' } };
    expect(mergeSettings(old).sleep.source).toBe('Withings');
    const fitbit = { ...defaultSettings(), sleep: { ...defaultSettings().sleep, source: 'Fitbit' } };
    expect(mergeSettings(fitbit).sleep.source).toBe('Fitbit');
  });
});
