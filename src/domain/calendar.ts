import ICAL from 'ical.js';
import { addDays, dayKey, daysBetween, startOfDay } from '../lib/dates';
import type { CalEvent, ClassifiedEvent, EventKind, MuscleGroup, Settings } from './types';

/** Window of occurrences we expand recurring events into. */
const PAST_DAYS = 60;
const FUTURE_DAYS = 200;

/**
 * Parses an iCalendar (.ics) feed, e.g. the "secret address in iCal format"
 * from Google Calendar, into flat event occurrences. Recurring events are
 * expanded inside a window around "now"; moved/cancelled occurrences are
 * honoured.
 */
export function parseIcs(text: string, calendarName?: string, now = new Date()): CalEvent[] {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const tz of root.getAllSubcomponents('vtimezone')) {
    ICAL.TimezoneService.register(tz);
  }
  const name = calendarName ?? (root.getFirstPropertyValue('x-wr-calname') as string | null) ?? undefined;

  const windowStart = addDays(startOfDay(now), -PAST_DAYS);
  const windowEnd = addDays(startOfDay(now), FUTURE_DAYS);

  // Group master events and their exceptions (RECURRENCE-ID) by UID.
  const masters = new Map<string, InstanceType<typeof ICAL.Event>>();
  const exceptions: InstanceType<typeof ICAL.Event>[] = [];
  for (const vevent of root.getAllSubcomponents('vevent')) {
    const ev = new ICAL.Event(vevent);
    if (ev.isRecurrenceException()) exceptions.push(ev);
    else masters.set(ev.uid, ev);
  }
  for (const ex of exceptions) {
    const master = masters.get(ex.uid);
    if (master) master.relateException(ex);
    else masters.set(`${ex.uid}#${ex.recurrenceId?.toString()}`, ex);
  }

  const out: CalEvent[] = [];
  for (const ev of masters.values()) {
    const status = (ev.component.getFirstPropertyValue('status') as string | null)?.toUpperCase();
    if (status === 'CANCELLED') continue;
    if (!ev.startDate) continue;

    if (ev.isRecurring()) {
      const it = ev.iterator();
      let guard = 0;
      for (let next = it.next(); next && guard < 2000; next = it.next(), guard++) {
        const jsStart = next.toJSDate();
        if (jsStart > windowEnd) break;
        const details = ev.getOccurrenceDetails(next);
        const s = details.startDate.toJSDate();
        const e = details.endDate.toJSDate();
        if (e < windowStart) continue;
        const occStatus = (details.item.component.getFirstPropertyValue('status') as string | null)?.toUpperCase();
        if (occStatus === 'CANCELLED') continue;
        out.push(toCalEvent(details.item, s, e, details.startDate.isDate, name));
      }
    } else {
      const s = ev.startDate.toJSDate();
      const e = ev.endDate ? ev.endDate.toJSDate() : s;
      if (e < windowStart || s > windowEnd) continue;
      out.push(toCalEvent(ev, s, e, ev.startDate.isDate, name));
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

function toCalEvent(
  ev: InstanceType<typeof ICAL.Event>,
  start: Date,
  end: Date,
  allDay: boolean,
  calendar?: string,
): CalEvent {
  return {
    id: `${ev.uid}@${start.toISOString()}`,
    uid: ev.uid,
    title: (ev.summary || '(ohne Titel)').trim(),
    start: start.toISOString(),
    end: end.toISOString(),
    allDay,
    location: ev.location || undefined,
    description: ev.description ? ev.description.slice(0, 500) : undefined,
    calendar,
  };
}

function containsAny(haystack: string, needles: string[]): string | undefined {
  const h = haystack.toLocaleLowerCase('de-DE');
  return needles.find((n) => n.trim() && h.includes(n.trim().toLocaleLowerCase('de-DE')));
}

const FOCUS_RULES: { words: string[]; groups: MuscleGroup[] }[] = [
  { words: ['push', 'drück'], groups: ['brust', 'schultern', 'trizeps'] },
  { words: ['pull', 'ziehen'], groups: ['ruecken', 'bizeps'] },
  { words: ['bein', 'leg', 'unterkörper', 'lower', 'squat'], groups: ['beine', 'po', 'beinbeuger', 'waden'] },
  { words: ['oberkörper', 'upper'], groups: ['brust', 'ruecken', 'schultern', 'bizeps', 'trizeps'] },
  { words: ['ganzkörper', 'full body', 'fullbody', 'ganzkoerper'], groups: ['beine', 'brust', 'ruecken', 'schultern', 'core'] },
  { words: ['brust', 'chest'], groups: ['brust'] },
  { words: ['rücken', 'ruecken', 'back'], groups: ['ruecken'] },
  { words: ['schulter', 'shoulder'], groups: ['schultern'] },
  { words: ['arm', 'bizeps', 'trizeps', 'biceps', 'triceps'], groups: ['bizeps', 'trizeps'] },
  { words: ['po', 'glute', 'gesäß'], groups: ['po', 'beinbeuger'] },
  { words: ['bauch', 'core', 'abs', 'rumpf'], groups: ['core'] },
  { words: ['cardio', 'ausdauer', 'hiit', 'laufen', 'running'], groups: ['cardio'] },
];

/** Parses the training focus from an event title like "Gym – Push" or "Beintraining". */
export function parseFocus(title: string): MuscleGroup[] {
  const t = title.toLocaleLowerCase('de-DE');
  const groups = new Set<MuscleGroup>();
  for (const rule of FOCUS_RULES) {
    if (rule.words.some((w) => matchesWord(t, w))) rule.groups.forEach((g) => groups.add(g));
  }
  if (groups.size === 0) return ['beine', 'brust', 'ruecken', 'schultern', 'core'];
  return [...groups];
}

function matchesWord(text: string, word: string): boolean {
  // Short words (po, arm, leg) must be whole words to avoid false hits ("Power", "Warm-up").
  if (word.length <= 3) {
    return new RegExp(`(^|[^a-zäöüß])${word}(e|s|n)?($|[^a-zäöüß])`, 'i').test(text);
  }
  return text.includes(word);
}

/** Removes the exam keyword and filler from a title to get the subject. */
export function extractSubject(title: string, keyword: string): string {
  const re = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
  const cleaned = title
    .replace(re, ' ')
    .replace(/[-–—:|/()[\]]+/g, ' ')
    .replace(/\b(in|im|der|die|das|zur|zum)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || title.trim();
}

export function classifyEvent(ev: CalEvent, keywords: Settings['keywords']): ClassifiedEvent {
  const text = ev.title;
  const klausur = containsAny(text, keywords.klausur);
  if (klausur) return { ...ev, kind: 'klausur', subject: extractSubject(text, klausur) };
  const test = containsAny(text, keywords.test);
  if (test) return { ...ev, kind: 'test', subject: extractSubject(text, test) };
  const lernen = containsAny(text, keywords.lernen);
  if (lernen) return { ...ev, kind: 'lernen' };
  const training = containsAny(text, keywords.training);
  if (training) return { ...ev, kind: 'training', focus: parseFocus(text) };
  return { ...ev, kind: 'other' };
}

export function classifyAll(events: CalEvent[], keywords: Settings['keywords']): ClassifiedEvent[] {
  return events.map((e) => classifyEvent(e, keywords));
}

export function eventDayKey(ev: CalEvent): string {
  return dayKey(new Date(ev.start));
}

export function eventDurationMin(ev: CalEvent): number {
  return Math.max(0, Math.round((new Date(ev.end).getTime() - new Date(ev.start).getTime()) / 60000));
}

export function upcoming(events: ClassifiedEvent[], now: Date, kinds?: EventKind[], days = 60): ClassifiedEvent[] {
  const todayKey = dayKey(now);
  return events
    .filter((e) => (!kinds || kinds.includes(e.kind)))
    .filter((e) => {
      const key = eventDayKey(e);
      const diff = daysBetween(todayKey, key);
      if (diff < 0 || diff > days) return false;
      // Timed events that are already over today drop out; all-day ones stay for the day.
      return e.allDay || new Date(e.end) >= now || diff > 0;
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function eventsOnDay(events: ClassifiedEvent[], key: string): ClassifiedEvent[] {
  return events.filter((e) => {
    const startKey = eventDayKey(e);
    if (startKey === key) return true;
    // Multi-day all-day events (end is exclusive).
    if (e.allDay) {
      const endKey = dayKey(new Date(new Date(e.end).getTime() - 1));
      return startKey <= key && key <= endKey;
    }
    return false;
  });
}

export const KIND_LABEL: Record<EventKind, string> = {
  klausur: 'Klausur',
  test: 'Test',
  training: 'Training',
  lernen: 'Lernen',
  other: 'Termin',
};
