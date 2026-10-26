import { clamp, dayKey, daysBetween, mean } from '../lib/dates';
import type { BrushSession } from './types';

export interface OralCareAnalysis {
  hasData: boolean;
  days: number;
  sessionsPerDay: number;
  avgDurationSec: number;
  avgCoverage?: number;
  pressureWarningsPerSession?: number;
  todayCount: number;
  streakDays: number;
  score: number;
  tips: string[];
}

export function analyzeOralCare(sessions: BrushSession[], today = new Date(), windowDays = 7): OralCareAnalysis {
  const todayKey = dayKey(today);
  const inWindow = sessions.filter((s) => {
    const diff = daysBetween(dayKey(new Date(s.date)), todayKey);
    return diff >= 0 && diff < windowDays;
  });
  const todayCount = sessions.filter((s) => dayKey(new Date(s.date)) === todayKey).length;
  const streakDays = brushingStreak(sessions, today);
  if (inWindow.length === 0) {
    return {
      hasData: false,
      days: windowDays,
      sessionsPerDay: 0,
      avgDurationSec: 0,
      todayCount,
      streakDays,
      score: 0,
      tips: ['Noch keine Putzdaten. Importiere einen Screenshot aus der Oral-B-App oder trage Putzvorgänge ein.'],
    };
  }

  // Use the number of days that actually have data (but at least the span since the first entry).
  const firstKey = inWindow.map((s) => dayKey(new Date(s.date))).sort()[0];
  const span = Math.min(windowDays, daysBetween(firstKey, todayKey) + 1);
  const sessionsPerDay = inWindow.length / span;
  const avgDurationSec = mean(inWindow.map((s) => s.durationSec));
  const withCoverage = inWindow.filter((s) => s.coveragePct !== undefined);
  const avgCoverage = withCoverage.length ? mean(withCoverage.map((s) => s.coveragePct!)) : undefined;
  const withPressure = inWindow.filter((s) => s.pressureWarnings !== undefined);
  const pressureWarningsPerSession = withPressure.length ? mean(withPressure.map((s) => s.pressureWarnings!)) : undefined;

  const freq = clamp((sessionsPerDay / 2) * 100, 0, 100);
  const dur = clamp((avgDurationSec / 120) * 100, 0, 100);
  const cov = avgCoverage !== undefined ? clamp(avgCoverage, 0, 100) : dur;
  const score = Math.round(freq * 0.4 + dur * 0.35 + cov * 0.25);

  const tips: string[] = [];
  if (sessionsPerDay < 1.8) tips.push(`Du putzt im Schnitt ${sessionsPerDay.toFixed(1).replace('.', ',')}× am Tag – Ziel sind 2× (morgens und abends).`);
  if (avgDurationSec < 115) tips.push(`Durchschnittlich ${Math.round(avgDurationSec)} s – nimm dir die vollen 2 Minuten.`);
  if (avgCoverage !== undefined && avgCoverage < 90) tips.push(`Abdeckung ${Math.round(avgCoverage)} % – achte auf die hinteren Backenzähne.`);
  if (pressureWarningsPerSession !== undefined && pressureWarningsPerSession >= 1) {
    tips.push('Häufige Druckwarnungen – lass die Bürste arbeiten und drück weniger fest.');
  }
  if (tips.length === 0) tips.push('Top Zahnpflege – weiter so!');

  return {
    hasData: true,
    days: span,
    sessionsPerDay,
    avgDurationSec,
    avgCoverage,
    pressureWarningsPerSession,
    todayCount,
    streakDays,
    score,
    tips,
  };
}

/** Consecutive days (ending today or yesterday) with at least two brushings. */
export function brushingStreak(sessions: BrushSession[], today = new Date()): number {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    const k = dayKey(new Date(s.date));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let streak = 0;
  const d = new Date(today);
  // Today may still be in progress – start yesterday if today isn't complete yet.
  if ((counts.get(dayKey(d)) ?? 0) < 2) d.setDate(d.getDate() - 1);
  while ((counts.get(dayKey(d)) ?? 0) >= 2) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** Merges imported sessions, skipping duplicates within 10 minutes. */
export function mergeSessions(existing: BrushSession[], incoming: BrushSession[]): BrushSession[] {
  const out = [...existing];
  for (const s of incoming) {
    const t = new Date(s.date).getTime();
    if (Number.isNaN(t)) continue;
    if (!out.some((o) => Math.abs(new Date(o.date).getTime() - t) < 10 * 60_000)) out.push(s);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
