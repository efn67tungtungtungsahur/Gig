import { parseIcs } from '../domain/calendar';
import type { CalendarData, CalEvent } from '../domain/types';
import { httpRequest } from './http';

/** Accepts webcal:// links and trims whitespace. */
export function normalizeIcsUrl(url: string): string {
  const u = url.trim();
  return u.startsWith('webcal://') ? `https://${u.slice('webcal://'.length)}` : u;
}

/** Fetches all configured iCal feeds (e.g. Google Calendar's secret iCal address). */
export async function syncCalendars(urls: string[], now = new Date()): Promise<CalendarData> {
  const events: CalEvent[] = [];
  const errors: string[] = [];
  await Promise.all(
    urls.filter((u) => u.trim()).map(async (raw, i) => {
      const url = normalizeIcsUrl(raw);
      try {
        const text = await httpRequest<string>({ url, responseType: 'text' });
        if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Keine gültige iCal-Datei – bitte die „Geheime Adresse im iCal-Format“ verwenden.');
        events.push(...parseIcs(text, undefined, now));
      } catch (e) {
        errors.push(`Kalender ${i + 1}: ${(e as Error).message}`);
      }
    }),
  );
  // Drop duplicates (same event in two calendars).
  const unique = new Map(events.map((e) => [e.id, e]));
  return {
    events: [...unique.values()].sort((a, b) => a.start.localeCompare(b.start)),
    syncedAt: now.toISOString(),
    errors,
  };
}

/** Imports a local .ics file picked by the user. */
export function importIcsText(text: string, now = new Date()): CalEvent[] {
  return parseIcs(text, undefined, now);
}
