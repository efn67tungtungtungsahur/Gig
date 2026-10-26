import { addDays, atTime, dayKey, hashId, startOfDay } from '../lib/dates';
import { biweeklyDates, holidayMessage } from './holidays';
import { examReminders, learningPhase } from './reminders';
import { weeklyDigest, type OverallReport } from './report';
import type { AppData, Settings } from './types';

export type NotificationChannel = 'pruefungen' | 'ferien' | 'schlaf' | 'bericht';

export interface PlannedNotification {
  id: number;
  channel: NotificationChannel;
  at: Date;
  title: string;
  body: string;
  /** Screen to open when tapped. */
  route: string;
}

/** How far ahead we schedule. The plan is rebuilt every time the app syncs. */
const HORIZON_DAYS = 180;
const SLEEP_DAYS = 7;

/**
 * Builds every local notification the app should have scheduled right now.
 * Pure function – the integration layer cancels the old set and schedules this one.
 */
export function buildNotificationPlan(
  data: AppData,
  settings: Settings,
  report: OverallReport,
  now = new Date(),
): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  const horizon = addDays(startOfDay(now), HORIZON_DAYS);

  // 1) Tests & Klausuren.
  for (const r of examReminders(report.events, settings, now)) {
    if (r.at > horizon) continue;
    out.push({
      id: hashId(`exam|${r.examId}|${r.offsetDays}`),
      channel: 'pruefungen',
      at: r.at,
      title: r.title,
      body: r.body,
      route: 'kalender',
    });
  }

  // 2) Ferien-Countdown alle 2 Wochen.
  if (settings.holidays.biweeklyEnabled) {
    for (const key of biweeklyDates(settings.holidays.anchor, now, horizon)) {
      const at = atTime(key, settings.holidays.time);
      if (at <= now) continue;
      const msg = holidayMessage(data.holidays.periods, key);
      out.push({ id: hashId(`ferien|${key}`), channel: 'ferien', at, title: msg.title, body: msg.body, route: 'start' });
    }
  }

  // 3) Schlaf-Erinnerung – nur wenn nötig und nicht in der Lernphase.
  const sleep = report.sleep;
  if (settings.sleep.remindersEnabled && sleep.shouldImprove && sleep.recommendedBedtime) {
    const [h, m] = sleep.recommendedBedtime.split(':').map(Number);
    const remindMinutes = (((h * 60 + m - 30) % 1440) + 1440) % 1440;
    for (let i = 0; i < SLEEP_DAYS; i++) {
      const day = addDays(startOfDay(now), i);
      // A reminder after midnight belongs to the night that starts on "day".
      const date = remindMinutes < 12 * 60 ? addDays(day, 1) : day;
      const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, remindMinutes);
      if (at <= now) continue;
      if (learningPhase(report.events, day, settings).active) continue;
      out.push({
        id: hashId(`schlaf|${dayKey(day)}`),
        channel: 'schlaf',
        at,
        title: `😴 In 30 Minuten Schlafenszeit`,
        body: `Geh um ${sleep.recommendedBedtime} ins Bett, um auf ${settings.sleep.goalHours} h zu kommen (zuletzt Ø ${Math.floor(
          sleep.avgAsleepMin / 60,
        )}:${String(Math.round(sleep.avgAsleepMin % 60)).padStart(2, '0')} h).`,
        route: 'gesundheit',
      });
    }
  }

  // 4) Gesamt-Update einmal pro Woche.
  if (settings.weeklyReport.enabled) {
    let day = startOfDay(now);
    for (let i = 0; i < 8; i++) {
      if (day.getDay() === settings.weeklyReport.weekday && atTime(day, settings.weeklyReport.time) > now) break;
      day = addDays(day, 1);
    }
    out.push({
      id: hashId(`bericht|${dayKey(day)}`),
      channel: 'bericht',
      at: atTime(day, settings.weeklyReport.time),
      title: '📊 Dein Wochen-Update ist da',
      body: weeklyDigest(report) || 'Tippe, um deine Auswertung zu sehen.',
      route: 'bericht',
    });
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}
