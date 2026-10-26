import { clamp, dayKey, daysBetween, formatMinutes, mean, median, minutesOfDay, stdDev, toHHMM } from '../lib/dates';
import type { SleepNight } from './types';

export type SleepVerdict = 'gut' | 'ausbaufaehig' | 'verbessern' | 'keine-daten';

export interface SleepAnalysis {
  verdict: SleepVerdict;
  shouldImprove: boolean;
  score: number; // 0–100
  nights: number;
  avgAsleepMin: number;
  goalMin: number;
  deficitMin: number;
  /** Std-dev of bedtime in minutes. */
  bedtimeSpreadMin: number;
  avgEfficiency?: number; // 0–1
  deepPct?: number;
  remPct?: number;
  typicalBedtime?: string; // HH:MM
  typicalWake?: string; // HH:MM
  recommendedBedtime?: string; // HH:MM
  trendMin: number; // last 3 nights vs. the 4 before (positive = more sleep)
  lastNight?: SleepNight;
  tips: string[];
  headline: string;
}

/** Minutes after 12:00 – keeps bedtimes around midnight on one continuous scale. */
function minutesAfterNoon(iso: string): number {
  const m = minutesOfDay(new Date(iso));
  return (m - 720 + 1440) % 1440;
}

export function analyzeSleep(allNights: SleepNight[], goalHours: number, today = new Date(), windowDays = 7): SleepAnalysis {
  const goalMin = Math.round(goalHours * 60);
  const todayKey = dayKey(today);
  const nights = allNights
    .filter((n) => {
      const diff = daysBetween(n.date, todayKey);
      return diff >= 0 && diff < windowDays;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  if (nights.length < 2) {
    return {
      verdict: 'keine-daten',
      shouldImprove: false,
      score: 0,
      nights: nights.length,
      avgAsleepMin: nights[0]?.minutesAsleep ?? 0,
      goalMin,
      deficitMin: 0,
      bedtimeSpreadMin: 0,
      trendMin: 0,
      lastNight: nights[nights.length - 1],
      tips: ['Noch keine Schlafdaten. Unter „Schlafquellen“ siehst du, welche App Schlaf liefert und wie du Withings über Health Connect freischaltest.'],
      headline: 'Noch zu wenig Schlafdaten',
    };
  }

  const asleep = nights.map((n) => n.minutesAsleep);
  const avgAsleepMin = mean(asleep);
  const deficitMin = Math.max(0, goalMin - avgAsleepMin);
  const bedtimes = nights.map((n) => minutesAfterNoon(n.start));
  const wakes = nights.map((n) => minutesOfDay(new Date(n.end)));
  const bedtimeSpreadMin = stdDev(bedtimes);

  const withBed = nights.filter((n) => n.minutesInBed > 0);
  const avgEfficiency = withBed.length ? mean(withBed.map((n) => n.minutesAsleep / n.minutesInBed)) : undefined;

  const staged = nights.filter((n) => (n.deep ?? 0) + (n.rem ?? 0) + (n.light ?? 0) > 0);
  const deepPct = staged.length ? mean(staged.map((n) => (n.deep ?? 0) / Math.max(1, n.minutesAsleep))) : undefined;
  const remPct = staged.length ? mean(staged.map((n) => (n.rem ?? 0) / Math.max(1, n.minutesAsleep))) : undefined;

  const recent = asleep.slice(-3);
  const before = asleep.slice(0, -3);
  const trendMin = before.length ? mean(recent) - mean(before) : 0;

  // Score: duration 60 %, regularity 20 %, quality 20 %.
  const durationScore = clamp(100 - (deficitMin / 120) * 100, 0, 100);
  const regularityScore = clamp(100 - ((bedtimeSpreadMin - 20) / 70) * 100, 0, 100);
  let qualityScore = 75;
  if (avgEfficiency !== undefined) qualityScore = clamp(((avgEfficiency - 0.75) / 0.17) * 100, 0, 100);
  if (deepPct !== undefined) qualityScore = (qualityScore + clamp((deepPct / 0.16) * 100, 0, 100)) / 2;
  const score = Math.round(durationScore * 0.6 + regularityScore * 0.2 + qualityScore * 0.2);

  const typicalBed = median(bedtimes);
  const typicalWake = median(wakes);
  // Fall-asleep buffer of 15 minutes.
  const recommendedBedtime = toHHMM(typicalWake - goalMin - 15);

  const tips: string[] = [];
  if (deficitMin >= 20) {
    tips.push(
      `Du schläfst im Schnitt ${formatMinutes(avgAsleepMin)} – ${formatMinutes(deficitMin)} unter deinem Ziel. ` +
        `Geh gegen ${recommendedBedtime} ins Bett, um auf ${goalHours} h zu kommen.`,
    );
  }
  if (bedtimeSpreadMin > 50) {
    tips.push(
      `Deine Einschlafzeit schwankt um ±${Math.round(bedtimeSpreadMin)} min. Feste Zeiten (auch am Wochenende) machen den Schlaf erholsamer.`,
    );
  }
  if (avgEfficiency !== undefined && avgEfficiency < 0.85) {
    tips.push(
      `Schlafeffizienz ${Math.round(avgEfficiency * 100)} %: Du liegst oft wach. Handy 30 min vor dem Schlafen weglegen, Zimmer kühl und dunkel halten.`,
    );
  }
  if (deepPct !== undefined && deepPct < 0.13) {
    tips.push(`Wenig Tiefschlaf (${Math.round(deepPct * 100)} %). Kein Koffein nach 14 Uhr und Training nicht direkt vor dem Schlafen hilft.`);
  }
  if (trendMin < -30) tips.push(`Die letzten Nächte waren ${Math.round(-trendMin)} min kürzer als davor – plane bewusst Ausgleich ein.`);

  const verdict: SleepVerdict = score >= 80 && deficitMin < 30 ? 'gut' : score >= 60 ? 'ausbaufaehig' : 'verbessern';
  const shouldImprove = verdict !== 'gut';
  if (!shouldImprove) tips.push('Dein Schlaf passt – weiter so!');

  const headline = {
    gut: 'Dein Schlaf ist gut',
    ausbaufaehig: 'Dein Schlaf ist ausbaufähig',
    verbessern: 'Du solltest deinen Schlaf verbessern',
    'keine-daten': '',
  }[verdict];

  return {
    verdict,
    shouldImprove,
    score,
    nights: nights.length,
    avgAsleepMin,
    goalMin,
    deficitMin,
    bedtimeSpreadMin,
    avgEfficiency,
    deepPct,
    remPct,
    typicalBedtime: toHHMM(typicalBed + 720),
    typicalWake: toHHMM(typicalWake),
    recommendedBedtime,
    trendMin,
    lastNight: nights[nights.length - 1],
    tips,
    headline,
  };
}

/** Collapses raw sleep sessions into one main night per wake-up day (naps are dropped). */
/** Shorter sessions are naps and never replace a night. */
const MIN_NIGHT_MIN = 120;

/**
 * One main night per wake-up day, the longest sleep. With a source (e.g.
 * "Withings") only that app's sleep counts – everything else is ignored.
 */
export function mainNights(sessions: SleepNight[], source = 'alle'): SleepNight[] {
  const byDay = new Map<string, SleepNight>();
  for (const s of sessions) {
    if (source !== 'alle' && s.source !== source) continue;
    const existing = byDay.get(s.date);
    if (!existing || s.minutesAsleep > existing.minutesAsleep) byDay.set(s.date, s);
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Nights (sessions of 2 h or more) per source, most first. */
export function sleepSourceCounts(sessions: SleepNight[]): { source: string; nights: number }[] {
  const days = new Map<string, Set<string>>();
  for (const s of sessions) {
    if (s.minutesAsleep < MIN_NIGHT_MIN) continue;
    const src = s.source ?? 'Unbekannt';
    days.set(src, (days.get(src) ?? new Set()).add(s.date));
  }
  return [...days.entries()].map(([source, d]) => ({ source, nights: d.size })).sort((a, b) => b.nights - a.nights);
}
