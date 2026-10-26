import { Health, type HealthDataType, type HealthSample } from '@capgo/capacitor-health';
import { dayKey } from '../lib/dates';
import { mainNights } from '../domain/sleep';
import type { DayValue, HealthData, Measurement, SleepNight, WorkoutEntry } from '../domain/types';
import { isNative } from './http';

/** Data types read from Health Connect (Fitbit, Withings, Liftoff … write into it). */
export const READ_TYPES: HealthDataType[] = [
  'sleep',
  'steps',
  'distance',
  'calories',
  'restingHeartRate',
  'heartRateVariability',
  'weight',
  'bodyFat',
  'bloodPressure',
  'workouts',
];

const KNOWN_SOURCES: Record<string, string> = {
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.withings.wiscale2': 'Withings',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.google.android.apps.healthdata': 'Health Connect',
  'com.sec.android.app.shealth': 'Samsung Health',
};

export function sourceLabel(sample: { sourceName?: string; sourceId?: string }): string | undefined {
  if (sample.sourceId && KNOWN_SOURCES[sample.sourceId]) return KNOWN_SOURCES[sample.sourceId];
  if (sample.sourceId?.toLowerCase().includes('liftoff') || sample.sourceId?.toLowerCase().includes('gymbros')) return 'Liftoff';
  return sample.sourceName || sample.sourceId;
}

export async function healthAvailability(): Promise<{ available: boolean; reason?: string }> {
  if (!isNative) return { available: false, reason: 'Health Connect gibt es nur in der Android-App.' };
  try {
    const res = await Health.isAvailable();
    return { available: res.available, reason: res.reason };
  } catch (e) {
    return { available: false, reason: (e as Error).message };
  }
}

export async function requestHealthPermissions(): Promise<{ granted: HealthDataType[]; denied: HealthDataType[] }> {
  const res = await Health.requestAuthorization({ read: READ_TYPES, requestHistoryAccess: true });
  return { granted: res.readAuthorized, denied: res.readDenied };
}

export async function openHealthConnect(): Promise<void> {
  await Health.openHealthConnectSettings();
}

const iso = (d: Date) => d.toISOString();

async function safe<T>(fn: () => Promise<T>, fallback: T, errors: string[], label: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    errors.push(`${label}: ${(e as Error).message}`);
    return fallback;
  }
}

async function daily(dataType: HealthDataType, start: Date, end: Date, aggregation: 'sum' | 'average'): Promise<DayValue[]> {
  const res = await Health.queryAggregated({ dataType, startDate: iso(start), endDate: iso(end), bucket: 'day', aggregation });
  return res.samples
    .filter((s) => Number.isFinite(s.value))
    .map((s) => ({ date: dayKey(new Date(s.startDate)), value: Math.round(s.value * 10) / 10 }));
}

async function samples(dataType: HealthDataType, start: Date, end: Date, limit = 500): Promise<HealthSample[]> {
  const res = await Health.readSamples({ dataType, startDate: iso(start), endDate: iso(end), limit, ascending: true });
  return res.samples;
}

function toNight(s: HealthSample): SleepNight {
  const minutesInBed = Math.round((new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000);
  const stage = (name: string) =>
    s.stages?.filter((st) => st.stage === name).reduce((sum, st) => sum + st.durationMinutes, 0) ?? 0;
  const deep = stage('deep');
  const rem = stage('rem');
  const light = stage('light') + stage('asleep');
  const awake = stage('awake');
  const minutesAsleep = s.hasStageData ? deep + rem + light : minutesInBed;
  return {
    date: dayKey(new Date(s.endDate)),
    start: s.startDate,
    end: s.endDate,
    minutesInBed,
    minutesAsleep,
    deep: s.hasStageData ? deep : undefined,
    rem: s.hasStageData ? rem : undefined,
    light: s.hasStageData ? light : undefined,
    awake: s.hasStageData ? awake : undefined,
    source: sourceLabel(s),
  };
}

function toMeasurements(list: HealthSample[]): Measurement[] {
  return list.map((s) => ({ date: s.startDate, value: Math.round(s.value * 100) / 100, source: sourceLabel(s) }));
}

/** Daily average of instantaneous samples (resting HR, HRV). */
function dailyAverage(list: HealthSample[]): DayValue[] {
  const byDay = new Map<string, number[]>();
  for (const s of list) {
    const k = dayKey(new Date(s.startDate));
    byDay.set(k, [...(byDay.get(k) ?? []), s.value]);
  }
  return [...byDay.entries()]
    .map(([date, vals]) => ({ date, value: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Reads the last weeks of data from Health Connect. */
export async function syncHealth(now = new Date(), sleepSource = 'Withings'): Promise<HealthData> {
  const errors: string[] = [];
  const end = now;
  const start30 = new Date(now.getTime() - 30 * 86_400_000);
  const start90 = new Date(now.getTime() - 90 * 86_400_000);
  // Steps, distance and workouts reach back a year for the badges.
  const start365 = new Date(now.getTime() - 365 * 86_400_000);

  const [sleepRaw, steps, distanceM, calories, rhr, hrv, weight, bodyFat, bp, workoutsRes] = await Promise.all([
    safe(() => samples('sleep', start30, end, 200), [], errors, 'Schlaf'),
    safe(() => daily('steps', start365, end, 'sum'), [], errors, 'Schritte'),
    safe(() => daily('distance', start365, end, 'sum'), [], errors, 'Strecke'),
    safe(() => daily('calories', start30, end, 'sum'), [], errors, 'Kalorien'),
    safe(() => samples('restingHeartRate', start30, end), [], errors, 'Ruhepuls'),
    safe(() => samples('heartRateVariability', start30, end), [], errors, 'HRV'),
    safe(() => samples('weight', start90, end), [], errors, 'Gewicht'),
    safe(() => samples('bodyFat', start90, end), [], errors, 'Körperfett'),
    safe(() => samples('bloodPressure', start90, end), [], errors, 'Blutdruck'),
    safe(() => Health.queryWorkouts({ startDate: iso(start365), endDate: iso(end), limit: 500, ascending: true }), { workouts: [] }, errors, 'Workouts'),
  ]);

  const workouts: WorkoutEntry[] = workoutsRes.workouts.map((w) => ({
    start: w.startDate,
    end: w.endDate,
    type: w.workoutType,
    durationMin: Math.round(w.duration / 60),
    calories: w.totalEnergyBurned ? Math.round(w.totalEnergyBurned) : undefined,
    distanceKm: w.totalDistance ? Math.round(w.totalDistance / 10) / 100 : undefined,
    source: sourceLabel(w),
  }));

  const all = [...sleepRaw, ...rhr, ...weight, ...bodyFat, ...bp];
  const sources = new Set<string>();
  for (const s of all) {
    const label = sourceLabel(s);
    if (label) sources.add(label);
  }
  workouts.forEach((w) => w.source && sources.add(w.source));

  return {
    sleep: mainNights(sleepRaw.map(toNight), sleepSource),
    sleepSessions: sleepRaw.map(toNight),
    steps,
    distance: distanceM.map((d) => ({ date: d.date, value: Math.round(d.value / 10) / 100 })),
    activeCalories: calories,
    restingHr: dailyAverage(rhr),
    hrv: dailyAverage(hrv),
    weight: toMeasurements(weight),
    bodyFat: toMeasurements(bodyFat),
    bloodPressure: bp
      .filter((s) => s.systolic && s.diastolic)
      .map((s) => ({ date: s.startDate, systolic: Math.round(s.systolic!), diastolic: Math.round(s.diastolic!), source: sourceLabel(s) })),
    workouts,
    sources: [...sources],
    syncedAt: now.toISOString(),
    error: errors.length ? errors.join(' · ') : undefined,
  };
}
