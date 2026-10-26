import {
  addDays,
  brandenburgPublicHolidays,
  dayKey,
  daysBetween,
  formatShort,
  fromDayKey,
  isWeekend,
} from '../lib/dates';
import type { HolidayPeriod } from './types';

// Schulferien Brandenburg (MBJS). Bundled so the countdown works offline;
// the app refreshes them from openholidaysapi.org when online.
export const BUNDLED_HOLIDAYS: HolidayPeriod[] = [
  { name: 'Herbstferien', start: '2025-10-20', end: '2025-11-01' },
  { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-02' },
  { name: 'Winterferien', start: '2026-02-02', end: '2026-02-07' },
  { name: 'Osterferien', start: '2026-03-30', end: '2026-04-10' },
  { name: 'Unterrichtsfreier Tag', start: '2026-05-15', end: '2026-05-15' },
  { name: 'Pfingstferien', start: '2026-05-26', end: '2026-05-26' },
  { name: 'Sommerferien', start: '2026-07-09', end: '2026-08-22' },
  { name: 'Herbstferien', start: '2026-10-19', end: '2026-10-30' },
  { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-02' },
  { name: 'Winterferien', start: '2027-02-01', end: '2027-02-06' },
  { name: 'Osterferien', start: '2027-03-22', end: '2027-04-03' },
  { name: 'Beweglicher Ferientag', start: '2027-05-07', end: '2027-05-07' },
  { name: 'Sommerferien', start: '2027-07-01', end: '2027-08-14' },
  { name: 'Herbstferien', start: '2027-10-11', end: '2027-10-23' },
  { name: 'Weihnachtsferien', start: '2027-12-23', end: '2027-12-31' },
  { name: 'Winterferien', start: '2028-01-31', end: '2028-02-05' },
  { name: 'Osterferien', start: '2028-04-10', end: '2028-04-22' },
  { name: 'Sommerferien', start: '2028-06-29', end: '2028-08-12' },
];

/** Periods shorter than this count as single free days, not "Ferien". */
const MIN_FERIEN_DAYS = 3;

export function periodLength(p: HolidayPeriod): number {
  return daysBetween(p.start, p.end) + 1;
}

export function isRealFerien(p: HolidayPeriod): boolean {
  return periodLength(p) >= MIN_FERIEN_DAYS;
}

export interface HolidayStatus {
  /** Ferien that are going on today, if any. */
  current?: HolidayPeriod;
  /** Days left in the current Ferien including today. */
  currentDaysLeft?: number;
  /** First day of school after the current Ferien. */
  backToSchool?: string;
  next?: HolidayPeriod;
  daysUntilNext?: number;
  /** School days (Mo–Fr without Feiertage and free days) until next Ferien. */
  schoolDaysUntilNext?: number;
  /** Single free days before the next Ferien. */
  freeDaysBefore: HolidayPeriod[];
}

function sortPeriods(periods: HolidayPeriod[]): HolidayPeriod[] {
  return [...periods].sort((a, b) => a.start.localeCompare(b.start));
}

export function holidayStatus(periods: HolidayPeriod[], today: Date | string): HolidayStatus {
  const todayKey = typeof today === 'string' ? today : dayKey(today);
  const sorted = sortPeriods(periods);
  const ferien = sorted.filter(isRealFerien);

  const current = ferien.find((p) => p.start <= todayKey && todayKey <= p.end);
  const next = ferien.find((p) => p.start > todayKey);
  const status: HolidayStatus = { freeDaysBefore: [] };

  if (current) {
    status.current = current;
    status.currentDaysLeft = daysBetween(todayKey, current.end) + 1;
    status.backToSchool = nextSchoolDay(current.end, sorted);
  }
  if (next) {
    status.next = next;
    status.daysUntilNext = daysBetween(todayKey, next.start);
    status.schoolDaysUntilNext = countSchoolDays(todayKey, next.start, sorted);
    status.freeDaysBefore = sorted.filter(
      (p) => !isRealFerien(p) && p.start > todayKey && p.start < next.start,
    );
  }
  return status;
}

function isFreeDay(key: string, periods: HolidayPeriod[]): boolean {
  const d = fromDayKey(key);
  if (isWeekend(d)) return true;
  if (brandenburgPublicHolidays(d.getFullYear()).has(key)) return true;
  return periods.some((p) => p.start <= key && key <= p.end);
}

function nextSchoolDay(afterKey: string, periods: HolidayPeriod[]): string {
  let d = addDays(fromDayKey(afterKey), 1);
  for (let i = 0; i < 30 && isFreeDay(dayKey(d), periods); i++) d = addDays(d, 1);
  return dayKey(d);
}

/** School days in [fromKey, toKey) – today counts if it is a school day. */
export function countSchoolDays(fromKey: string, toKey: string, periods: HolidayPeriod[]): number {
  let count = 0;
  let d = fromDayKey(fromKey);
  const end = fromDayKey(toKey);
  while (d < end) {
    if (!isFreeDay(dayKey(d), periods)) count++;
    d = addDays(d, 1);
  }
  return count;
}

/** Text for the biweekly holiday update. */
export function holidayMessage(periods: HolidayPeriod[], day: Date | string): { title: string; body: string } {
  const s = holidayStatus(periods, day);
  if (s.current && s.currentDaysLeft !== undefined) {
    const nextPart = s.next && s.daysUntilNext !== undefined
      ? ` Danach noch ${s.daysUntilNext} Tage bis zu den ${s.next.name}.`
      : '';
    return {
      title: `🏖️ Gerade sind ${s.current.name}!`,
      body: `Noch ${s.currentDaysLeft} ${s.currentDaysLeft === 1 ? 'Tag' : 'Tage'} frei – Schule ab ${formatShort(s.backToSchool!)}.${nextPart}`,
    };
  }
  if (s.next && s.daysUntilNext !== undefined) {
    const school = s.schoolDaysUntilNext !== undefined ? ` (${s.schoolDaysUntilNext} Schultage)` : '';
    return {
      title: `🏖️ Noch ${s.daysUntilNext} Tage bis zu den ${s.next.name}`,
      body: `Die ${s.next.name} in Brandenburg beginnen am ${formatShort(s.next.start)}${school}.`,
    };
  }
  return { title: '🏖️ Ferien-Update', body: 'Für die nächsten Ferien liegen noch keine Termine vor.' };
}

/** Dates (YYYY-MM-DD) of the biweekly update between from and until, anchored on anchorKey. */
export function biweeklyDates(anchorKey: string, from: Date, until: Date, intervalDays = 14): string[] {
  const out: string[] = [];
  const anchor = fromDayKey(anchorKey);
  // First occurrence on or after "from".
  let n = Math.max(0, Math.ceil(daysBetween(anchorKey, dayKey(from)) / intervalDays));
  for (;;) {
    const d = addDays(anchor, n * intervalDays);
    if (d > until) break;
    out.push(dayKey(d));
    n++;
  }
  return out;
}

/** Converts an OpenHolidays API response into periods. */
export function parseOpenHolidays(json: unknown): HolidayPeriod[] {
  if (!Array.isArray(json)) return [];
  const out: HolidayPeriod[] = [];
  for (const item of json) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as { startDate?: string; endDate?: string; name?: { language?: string; text?: string }[] };
    if (!rec.startDate || !rec.endDate) continue;
    const name = rec.name?.find((n) => n.language === 'DE')?.text ?? rec.name?.[0]?.text ?? 'Ferien';
    out.push({ name: normalizeHolidayName(name), start: rec.startDate.slice(0, 10), end: rec.endDate.slice(0, 10) });
  }
  return sortPeriods(out);
}

function normalizeHolidayName(name: string): string {
  const n = name.trim();
  // The API uses e.g. "Herbstferien" already; make sure "...ferien" is capitalised.
  return n.charAt(0).toUpperCase() + n.slice(1);
}
