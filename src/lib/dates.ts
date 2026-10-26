// Date helpers. Everything works in the device's local time zone and uses
// "day keys" (YYYY-MM-DD) for calendar-day arithmetic, so DST changes never
// shift a day.

const MS_PER_DAY = 86_400_000;

export const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const WEEKDAYS_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const MONTHS_LONG = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Local calendar day of a date as YYYY-MM-DD. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses a YYYY-MM-DD key into a Date at local midnight. */
export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function addDaysKey(key: string, days: number): string {
  return dayKey(addDays(fromDayKey(key), days));
}

/** Whole calendar days from a to b (b - a), ignoring time of day. */
export function daysBetween(a: Date | string, b: Date | string): number {
  const da = typeof a === 'string' ? fromDayKey(a) : startOfDay(a);
  const db = typeof b === 'string' ? fromDayKey(b) : startOfDay(b);
  // Use UTC to avoid DST offsets turning 24h into 23h/25h.
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((ub - ua) / MS_PER_DAY);
}

/** Returns a Date on the given day at "HH:MM" local time. */
export function atTime(day: Date | string, hhmm: string): Date {
  const base = typeof day === 'string' ? fromDayKey(day) : startOfDay(day);
  const [h, m] = parseHHMM(hhmm);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
}

export function parseHHMM(hhmm: string): [number, number] {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return [0, 0];
  return [Math.min(23, Number(match[1])), Math.min(59, Number(match[2]))];
}

export function toHHMM(minutesOfDay: number): string {
  const m = ((Math.round(minutesOfDay) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** "Mo, 02.11." */
export function formatShort(d: Date | string): string {
  const date = typeof d === 'string' ? fromDayKey(d) : d;
  return `${WEEKDAYS_SHORT[date.getDay()]}, ${pad(date.getDate())}.${pad(date.getMonth() + 1)}.`;
}

/** "Montag, 2. November 2026" */
export function formatLong(d: Date | string): string {
  const date = typeof d === 'string' ? fromDayKey(d) : d;
  return `${WEEKDAYS_LONG[date.getDay()]}, ${date.getDate()}. ${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

/** "02.11.2026" */
export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? fromDayKey(d) : d;
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

export function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 412 → "6:52 h" */
export function formatMinutes(min: number): string {
  const m = Math.round(min);
  return `${Math.floor(m / 60)}:${pad(m % 60)} h`;
}

/** Relative day phrase in German: heute, morgen, übermorgen, in 5 Tagen, in 2 Wochen. */
export function relativeDays(days: number): string {
  if (days === 0) return 'heute';
  if (days === 1) return 'morgen';
  if (days === 2) return 'übermorgen';
  if (days === -1) return 'gestern';
  if (days < 0) return `vor ${-days} Tagen`;
  if (days % 7 === 0) return days === 7 ? 'in 1 Woche' : `in ${days / 7} Wochen`;
  return `in ${days} Tagen`;
}

/** Minutes since local midnight. */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function isWeekend(d: Date): boolean {
  return d.getDay() === 0 || d.getDay() === 6;
}

/** Easter Sunday (Gregorian, anonymous algorithm). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Public holidays in Brandenburg (Feiertage) for a year as day keys. */
export function brandenburgPublicHolidays(year: number): Map<string, string> {
  const easter = easterSunday(year);
  const map = new Map<string, string>();
  map.set(`${year}-01-01`, 'Neujahr');
  map.set(dayKey(addDays(easter, -2)), 'Karfreitag');
  map.set(dayKey(easter), 'Ostersonntag');
  map.set(dayKey(addDays(easter, 1)), 'Ostermontag');
  map.set(`${year}-05-01`, 'Tag der Arbeit');
  map.set(dayKey(addDays(easter, 39)), 'Christi Himmelfahrt');
  map.set(dayKey(addDays(easter, 49)), 'Pfingstsonntag');
  map.set(dayKey(addDays(easter, 50)), 'Pfingstmontag');
  map.set(`${year}-10-03`, 'Tag der Deutschen Einheit');
  map.set(`${year}-10-31`, 'Reformationstag');
  map.set(`${year}-12-25`, '1. Weihnachtstag');
  map.set(`${year}-12-26`, '2. Weihnachtstag');
  return map;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Stable 31-bit positive hash, used for notification ids. */
export function hashId(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 1) || 1;
}
