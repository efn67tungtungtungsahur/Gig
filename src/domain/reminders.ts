import { addDays, atTime, dayKey, daysBetween, formatShort, fromDayKey, relativeDays } from '../lib/dates';
import { eventDayKey, eventsOnDay } from './calendar';
import type { ClassifiedEvent, Settings } from './types';

export interface ExamReminder {
  examId: string;
  kind: 'klausur' | 'test';
  subject: string;
  examDay: string;
  offsetDays: number;
  at: Date;
  title: string;
  body: string;
}

const TIPS: Record<number, string> = {
  14: 'Guter Zeitpunkt, einen Lernplan zu machen und den Stoff aufzuteilen.',
  7: 'Noch eine Woche – jetzt den Stoff wiederholen und Lücken finden.',
  3: 'Übe mit Aufgaben und alten Tests, kläre offene Fragen.',
  2: 'Letzte Wiederholung – und morgen nicht zu spät ins Bett.',
  1: 'Morgen ist es so weit. Sachen packen, kurz wiederholen, ausruhen.',
};

function tipFor(offset: number): string {
  return TIPS[offset] ?? 'Plane dir heute etwas Lernzeit ein.';
}

/**
 * All reminders for upcoming tests and Klausuren:
 * Test → 7, 3, 2 Tage vorher; Klausur → 14, 7, 3, 2 Tage vorher (configurable).
 * Reminders whose time has already passed are dropped.
 */
export function examReminders(events: ClassifiedEvent[], settings: Settings, now = new Date()): ExamReminder[] {
  if (!settings.reminders.enabled) return [];
  const out: ExamReminder[] = [];
  for (const ev of events) {
    if (ev.kind !== 'klausur' && ev.kind !== 'test') continue;
    const examDay = eventDayKey(ev);
    if (daysBetween(now, examDay) < 0) continue;
    const offsets = ev.kind === 'klausur' ? settings.reminders.klausurOffsets : settings.reminders.testOffsets;
    const label = ev.kind === 'klausur' ? 'Klausur' : 'Test';
    const emoji = ev.kind === 'klausur' ? '📚' : '📝';
    const subject = ev.subject || ev.title;
    for (const offset of [...new Set(offsets)].sort((a, b) => b - a)) {
      const at = atTime(addDays(fromDayKey(examDay), -offset), settings.reminders.time);
      if (at <= now) continue;
      out.push({
        examId: ev.id,
        kind: ev.kind,
        subject,
        examDay,
        offsetDays: offset,
        at,
        title: `${emoji} ${label} ${relativeDays(offset)}: ${subject}`,
        body: `${formatShort(examDay)} · ${tipFor(offset)}`,
      });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export interface LearningPhase {
  active: boolean;
  reason?: string;
  exam?: ClassifiedEvent;
}

/**
 * True when the calendar says you have to study for a Klausur on that day:
 * either a "Lernen" event is planned that day, or a Klausur (optionally also
 * a test) is coming up within the configured number of days.
 */
export function learningPhase(events: ClassifiedEvent[], day: Date | string, settings: Settings): LearningPhase {
  const key = typeof day === 'string' ? day : dayKey(day);
  const lernEvent = eventsOnDay(events, key).find((e) => e.kind === 'lernen');
  const kinds = settings.sleep.pauseForTests ? ['klausur', 'test'] : ['klausur'];
  const exam = events
    .filter((e) => kinds.includes(e.kind))
    .map((e) => ({ e, diff: daysBetween(key, eventDayKey(e)) }))
    .filter(({ diff }) => diff >= 0 && diff <= settings.sleep.learningPhaseDays)
    .sort((a, b) => a.diff - b.diff)[0];

  if (exam) {
    const what = exam.e.kind === 'klausur' ? 'Klausur' : 'Test';
    return {
      active: true,
      exam: exam.e,
      reason: `Lernphase: ${what} ${exam.e.subject ?? exam.e.title} ${relativeDays(exam.diff)} (${formatShort(eventDayKey(exam.e))})`,
    };
  }
  if (lernEvent) {
    return { active: true, reason: `Lernphase: „${lernEvent.title}“ steht heute im Kalender` };
  }
  return { active: false };
}
