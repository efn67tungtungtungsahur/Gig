// Activity badges (similar in spirit to Fitbit): daily steps, lifetime distance and runs.

import type { ActivityArchive, AppData, HealthData } from './types';

/** Average step length used when no distance was recorded for a day. */
const KM_PER_STEP = 0.00074;

const RUN_TYPES = new Set(['running', 'runningTreadmill', 'trackAndField']);

export type BadgeCategory = 'schritte' | 'strecke' | 'laufen';

export interface BadgeDef {
  id: string;
  category: BadgeCategory;
  title: string;
  /** What has to be done, e.g. "10.000 Schritte an einem Tag". */
  goal: string;
  threshold: number;
  /** Short label on the badge, e.g. "10K". */
  short: string;
  /** 0-based tier inside its category (drives the color). */
  tier: number;
}

export interface Badge extends BadgeDef {
  earned: boolean;
  /** First time it was earned (YYYY-MM-DD). */
  firstDate?: string;
  lastDate?: string;
  /** How often (daily badges). */
  count: number;
  progress: number; // 0–1
  progressText: string;
}

const de = (n: number, digits = 0) => n.toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits });

const STEP_BADGES: [number, string][] = [
  [5000, 'Losgelaufen'],
  [10000, 'Zehntausender'],
  [15000, 'Stadtläufer'],
  [20000, 'Ausdauerheld'],
  [25000, 'Straßenfeger'],
  [30000, 'Ultra-Tag'],
  [40000, 'Unaufhaltsam'],
  [50000, 'Legendärer Tag'],
];

const DISTANCE_BADGES: [number, string, string][] = [
  [42.195, 'Marathon', 'Die Marathon-Distanz – insgesamt gegangen und gelaufen'],
  [90, 'Bis nach Berlin', 'Rund 90 km – von Frankfurt (Oder) nach Berlin'],
  [170, 'Rennsteig', 'Rund 170 km – der Rennsteig im Thüringer Wald'],
  [400, 'Die Spree', 'Rund 400 km – die ganze Spree von der Quelle bis zur Mündung'],
  [800, 'Jakobsweg', 'Rund 800 km – der Camino Francés bis Santiago'],
  [1230, 'Der Rhein', 'Rund 1.230 km – so lang ist der Rhein'],
  [2850, 'Die Donau', 'Rund 2.850 km – von Donaueschingen bis ans Schwarze Meer'],
  [6650, 'Der Nil', 'Rund 6.650 km – der Nil'],
  [12742, 'Quer durch die Erde', '12.742 km – der Durchmesser der Erde'],
  [40075, 'Einmal um die Welt', '40.075 km – einmal um den Äquator'],
];

const RUN_BADGES: [string, number, string, string][] = [
  ['erster', 1, 'Erster Lauf', 'Einen Lauf aufgezeichnet'],
  ['5k', 5, '5 km am Stück', 'Ein Lauf über mindestens 5 km'],
  ['10k', 10, '10 km am Stück', 'Ein Lauf über mindestens 10 km'],
  ['halb', 21.0975, 'Halbmarathon', 'Ein Lauf über 21,1 km'],
  ['marathon', 42.195, 'Marathon-Läufer', 'Ein Lauf über 42,2 km'],
  ['n10', 10, '10 Läufe', '10 Läufe aufgezeichnet'],
  ['n50', 50, '50 Läufe', '50 Läufe aufgezeichnet'],
  ['n100', 100, '100 Läufe', '100 Läufe aufgezeichnet'],
];

export const BADGE_DEFS: BadgeDef[] = [
  ...STEP_BADGES.map(([n, title], i) => ({
    id: `schritte-${n}`,
    category: 'schritte' as const,
    title,
    goal: `${de(n)} Schritte an einem Tag`,
    threshold: n,
    short: `${n / 1000}K`,
    tier: i,
  })),
  ...DISTANCE_BADGES.map(([km, title, goal], i) => ({
    id: `strecke-${Math.round(km)}`,
    category: 'strecke' as const,
    title,
    goal,
    threshold: km,
    short: de(Math.round(km)),
    tier: i,
  })),
  ...RUN_BADGES.map(([id, n, title, goal], i) => ({
    id: `laufen-${id}`,
    category: 'laufen' as const,
    title,
    goal,
    threshold: n,
    short: id.startsWith('n') ? `${n}×` : id === 'erster' ? '1.' : id === 'halb' ? '21,1' : id === 'marathon' ? '42,2' : `${n}K`,
    tier: i,
  })),
];

export const CATEGORY_LABEL: Record<BadgeCategory, string> = {
  schritte: 'Tagesschritte',
  strecke: 'Gesamtstrecke',
  laufen: 'Laufen',
};

/** Merges freshly synced Health Connect data into the long-term archive (max per day). */
export function mergeActivity(prev: ActivityArchive | undefined, health: Pick<HealthData, 'steps' | 'distance' | 'workouts'>): ActivityArchive {
  const days: ActivityArchive['days'] = { ...prev?.days };
  for (const s of health.steps) days[s.date] = { ...days[s.date], steps: Math.max(days[s.date]?.steps ?? 0, s.value) };
  for (const d of health.distance ?? []) days[d.date] = { ...days[d.date], km: Math.max(days[d.date]?.km ?? 0, d.value) };
  const runs = new Map((prev?.runs ?? []).map((r) => [r.start, r]));
  for (const w of health.workouts) {
    if (!RUN_TYPES.has(w.type)) continue;
    runs.set(w.start, { start: w.start, km: w.distanceKm ?? runs.get(w.start)?.km, min: w.durationMin });
  }
  return { days, runs: [...runs.values()].sort((a, b) => a.start.localeCompare(b.start)) };
}

export interface BadgeSummary {
  badges: Badge[];
  earned: number;
  total: number;
  lifetimeKm: number;
  /** Lifetime distance partly estimated from steps. */
  estimated: boolean;
  bestDay?: { date: string; steps: number };
  runs: number;
  /** Most recently unlocked first. */
  recent: Badge[];
  /** The unearned badge you are closest to. */
  next?: Badge;
}

export function computeBadges(data: AppData): BadgeSummary {
  // Archive plus whatever is synced right now (demo data has no archive).
  const archive = mergeActivity(data.activity, data.health);
  const dayList = Object.entries(archive.days).sort(([a], [b]) => a.localeCompare(b));
  let lifetimeKm = 0;
  let estimated = false;
  let bestDay: BadgeSummary['bestDay'];
  for (const [date, d] of dayList) {
    if (d.km) lifetimeKm += d.km;
    else if (d.steps) {
      lifetimeKm += d.steps * KM_PER_STEP;
      estimated = true;
    }
    if (d.steps && (!bestDay || d.steps > bestDay.steps)) bestDay = { date, steps: d.steps };
  }
  const runs = archive.runs;

  const badges: Badge[] = BADGE_DEFS.map((def) => {
    if (def.category === 'schritte') {
      const hits = dayList.filter(([, d]) => (d.steps ?? 0) >= def.threshold);
      const best = bestDay?.steps ?? 0;
      return {
        ...def,
        earned: hits.length > 0,
        firstDate: hits[0]?.[0],
        lastDate: hits.at(-1)?.[0],
        count: hits.length,
        progress: Math.min(1, best / def.threshold),
        progressText: hits.length ? `${hits.length}× geschafft` : `Bester Tag: ${de(best)} / ${de(def.threshold)}`,
      };
    }
    if (def.category === 'strecke') {
      let sum = 0;
      let firstDate: string | undefined;
      for (const [date, d] of dayList) {
        sum += d.km ?? (d.steps ?? 0) * KM_PER_STEP;
        if (!firstDate && sum >= def.threshold) firstDate = date;
      }
      return {
        ...def,
        earned: lifetimeKm >= def.threshold,
        firstDate,
        count: lifetimeKm >= def.threshold ? 1 : 0,
        progress: Math.min(1, lifetimeKm / def.threshold),
        progressText: `${de(Math.min(lifetimeKm, def.threshold), 1)} / ${de(def.threshold, def.threshold % 1 ? 1 : 0)} km`,
      };
    }
    // Runs: count badges or a single run over a distance.
    const byCount = def.id.startsWith('laufen-n') || def.id === 'laufen-erster';
    if (byCount) {
      const hit = runs.length >= def.threshold ? runs[def.threshold - 1] : undefined;
      return {
        ...def,
        earned: !!hit,
        firstDate: hit?.start.slice(0, 10),
        count: hit ? 1 : 0,
        progress: Math.min(1, runs.length / def.threshold),
        progressText: `${Math.min(runs.length, def.threshold)} / ${def.threshold} Läufe`,
      };
    }
    const hits = runs.filter((r) => (r.km ?? 0) >= def.threshold);
    const longest = Math.max(0, ...runs.map((r) => r.km ?? 0));
    return {
      ...def,
      earned: hits.length > 0,
      firstDate: hits[0]?.start.slice(0, 10),
      lastDate: hits.at(-1)?.start.slice(0, 10),
      count: hits.length,
      progress: Math.min(1, longest / def.threshold),
      progressText: hits.length ? `${hits.length}× geschafft` : `Längster Lauf: ${de(longest, 1)} / ${de(def.threshold, 1)} km`,
    };
  });

  const earned = badges.filter((b) => b.earned);
  const recent = [...earned].sort((a, b) => (b.firstDate ?? '').localeCompare(a.firstDate ?? '') || b.tier - a.tier).slice(0, 4);
  const next = badges.filter((b) => !b.earned && b.progress > 0).sort((a, b) => b.progress - a.progress)[0];
  return { badges, earned: earned.length, total: badges.length, lifetimeKm, estimated, bestDay, runs: runs.length, recent, next };
}
