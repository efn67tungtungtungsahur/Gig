// Turns on-device OCR text (ML Kit) from Liftoff and Oral-B screenshots into
// draft data. Nothing is saved directly – the user confirms the drafts first.

import { addDays, startOfDay } from '../lib/dates';
import type { BrushSession, LeaderboardEntry } from './types';

export interface OcrLine {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Re-assembles screen rows from OCR lines (ML Kit returns columns as separate blocks). */
export function linesToRows(lines: OcrLine[]): string[] {
  const sorted = [...lines].filter((l) => l.text.trim()).sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const rows: OcrLine[][] = [];
  for (const line of sorted) {
    const center = line.y + line.h / 2;
    const row = rows.find((r) => {
      const ref = r[0];
      return Math.abs(ref.y + ref.h / 2 - center) < Math.max(ref.h, line.h) * 0.55;
    });
    if (row) row.push(line);
    else rows.push([line]);
  }
  return rows.map((r) =>
    r
      .sort((a, b) => a.x - b.x)
      .map((l) => l.text.trim())
      .join('  '),
  );
}

function toNumber(s: string): number | undefined {
  const cleaned = s.replace(/[\s.,'’]/g, '');
  if (!/^\d+$/.test(cleaned)) return undefined;
  return Number(cleaned);
}

const TIER = /\b(Bronze|Silber|Silver|Gold|Platin|Platinum|Diamant|Diamond|Elite|Champion|Legende|Legend|Master|Meister|Grandmaster|Großmeister|Eisen|Iron|Smaragd|Emerald|Rubin|Ruby|Saphir|Sapphire|Titan|Obsidian)(?:\s+(IV|V|I{1,3}|[1-5]))?\b/i;

const UI_WORDS = /^(home|kg|lbs|min|von|of|der|die|das|und|and|·|-|start|profil|profile|settings|einstellungen|feed|workout|workouts|training|rangliste|leaderboard|leaderboards|ranking|rank|rang|errungenschaften|achievements|trophäen|trophies|badges|abzeichen|freunde|friends|global|weekly|woche|wöchentlich|monat|monthly|all time|gesamt|heute|today|xp|level|stufe|streak|serie|quests?|aufgaben|shop|eggs?|eier|alle|all|mehr|more|zurück|back|du|you|\d+)$/i;

export interface LiftoffDraft {
  rank?: string;
  position?: number;
  xp?: number;
  level?: number;
  streakDays?: number;
  leaderboard: LeaderboardEntry[];
  achievements: { name: string; unlocked: boolean; progress?: string; preselected: boolean }[];
}

export function parseLiftoffText(rows: string[], username?: string): LiftoffDraft {
  const draft: LiftoffDraft = { leaderboard: [], achievements: [] };
  const me = username?.trim().toLowerCase();
  let inAchievements = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].replace(/\s+/g, ' ').trim();
    if (!row) continue;
    let statRow = false;

    if (/achievement|errungenschaft|trophä|troph(y|ies)|badges?|abzeichen|erfolge/i.test(row) && row.length < 40) {
      inAchievements = true;
      continue;
    }
    if (/rangliste|leaderboard|ranking/i.test(row) && row.length < 40) inAchievements = false;

    const tier = TIER.exec(row);
    if (tier && !draft.rank && row.length < 30) {
      draft.rank = tier[2] ? `${cap(tier[1])} ${tier[2].toUpperCase()}` : cap(tier[1]);
      statRow = true;
    }

    const level = /\b(?:level|lvl|stufe|lv\.?)\s*(\d{1,3})\b/i.exec(row);
    if (level) {
      if (draft.level === undefined) draft.level = Number(level[1]);
      statRow = true;
    }

    const xp = /(\d[\d.,' ]*\d|\d)\s*XP\b/i.exec(row);
    const isLeaderRow = /^#?\s*\d{1,3}[.)]?\s+\S/.test(row) && /\d[\d.,]*\s*(xp|pts|punkte|points)?\s*$/i.test(row);
    if (xp && !isLeaderRow) {
      if (draft.xp === undefined) draft.xp = toNumber(xp[1]);
      statRow = true;
    }

    // "30-Day Streak" in the achievements list is an achievement, not your streak.
    const streak = inAchievements
      ? null
      :
      /(\d{1,4})\s*(?:-|\s)?(?:day|days|tage?|tag)\s*(?:streak|serie)/i.exec(row) ??
      /(?:streak|serie)\D{0,6}(\d{1,4})/i.exec(row) ??
      /(\d{1,4})\s*(?:-|\s)?(?:day|tage?)\s*(?:in a row|am stück|in folge)/i.exec(row);
    if (streak) {
      if (draft.streakDays === undefined) draft.streakDays = Number(streak[1]);
      statRow = true;
    }

    const pos = /(?:#|platz|rang|rank|position|pos\.)\s*(\d{1,4})\b/i.exec(row) ?? /\b(\d{1,4})(?:st|nd|rd|th|\.)\s*(?:place|platz)\b/i.exec(row);
    if (pos && !isLeaderRow) {
      if (draft.position === undefined) draft.position = Number(pos[1]);
      statRow = true;
    }
    if (statRow) continue;

    // Leaderboard row: "7  Lena  2.310 XP" (position, name, score).
    const lb = /^#?\s*(\d{1,3})[.)]?\s+(.+?)\s+(\d[\d.,]*)\s*(?:xp|pts|punkte|points)?$/i.exec(row);
    if (lb) {
      const name = lb[2].trim();
      const isMe = /^(du|you|ich|me)\b/i.test(name) || /\((du|you)\)/i.test(name) || (!!me && name.toLowerCase().includes(me));
      draft.leaderboard.push({ position: Number(lb[1]), name, score: toNumber(lb[3]), isMe });
      continue;
    }

    // Achievement candidates: mostly letters, not a UI word.
    const progress = /(\d+)\s*\/\s*(\d+)/.exec(row);
    const text = row.replace(/(\d+)\s*\/\s*(\d+)/, '').replace(/[🔒🏆✓✔︎•·|]/gu, '').trim();
    const letters = text.replace(/[^A-Za-zÄÖÜäöüß]/g, '').length;
    // Rows made only of UI words ("Friends · Weekly") are navigation – except in the
    // achievements list, where "50 Workouts" is a real achievement.
    const onlyUiWords = text.split(/\s+/).every((w) => UI_WORDS.test(w)) && !(inAchievements && /\d/.test(text));
    if (letters >= 3 && letters / Math.max(1, text.length) > 0.35 && text.length <= 40 && !onlyUiWords) {
      const locked = /🔒|locked|gesperrt|noch nicht/i.test(row) || (progress ? Number(progress[1]) < Number(progress[2]) : false);
      if (!draft.achievements.some((a) => a.name === text)) {
        draft.achievements.push({ name: text, unlocked: !locked, progress: progress ? `${progress[1]}/${progress[2]}` : undefined, preselected: inAchievements });
      }
    } else if (progress && draft.achievements.length && inAchievements) {
      // Progress on its own row belongs to the achievement above.
      const last = draft.achievements[draft.achievements.length - 1];
      last.progress = `${progress[1]}/${progress[2]}`;
      last.unlocked = Number(progress[1]) >= Number(progress[2]);
    }
  }

  const mine = draft.leaderboard.find((e) => e.isMe);
  if (mine && draft.position === undefined) draft.position = mine.position;
  return draft;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// ---------- Oral-B ----------

const WEEKDAYS: Record<string, number> = {
  so: 0, sonntag: 0, sun: 0, sunday: 0,
  mo: 1, montag: 1, mon: 1, monday: 1,
  di: 2, dienstag: 2, tue: 2, tuesday: 2,
  mi: 3, mittwoch: 3, wed: 3, wednesday: 3,
  do: 4, donnerstag: 4, thu: 4, thursday: 4,
  fr: 5, freitag: 5, fri: 5, friday: 5,
  sa: 6, samstag: 6, sat: 6, saturday: 6,
};

const MONTHS: Record<string, number> = {
  jan: 0, januar: 0, january: 0, feb: 1, februar: 1, february: 1, mär: 2, märz: 2, mar: 2, march: 2, apr: 3, april: 3,
  mai: 4, may: 4, jun: 5, juni: 5, june: 5, jul: 6, juli: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  okt: 9, oktober: 9, oct: 9, october: 9, nov: 10, november: 10, dez: 11, dezember: 11, dec: 11, december: 11,
};

/** Day mentioned in a row ("Heute", "Gestern", "Mo., 26. Okt.", "26.10."), or undefined. */
export function parseDay(row: string, now: Date): Date | undefined {
  const today = startOfDay(now);
  const r = row.toLowerCase();
  if (/\b(heute|today)\b/.test(r)) return today;
  if (/\b(gestern|yesterday)\b/.test(r)) return addDays(today, -1);
  if (/\b(vorgestern)\b/.test(r)) return addDays(today, -2);
  const numeric = /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/.exec(r);
  if (numeric) return pastDate(Number(numeric[1]), Number(numeric[2]) - 1, numeric[3], today);
  const named = /\b(\d{1,2})\.?\s*([a-zäöü]{3,9})\.?/.exec(r);
  if (named && MONTHS[named[2]] !== undefined) return pastDate(Number(named[1]), MONTHS[named[2]], undefined, today);
  const namedUs = /\b([a-z]{3,9})\.?\s+(\d{1,2})\b/.exec(r);
  if (namedUs && MONTHS[namedUs[1]] !== undefined) return pastDate(Number(namedUs[2]), MONTHS[namedUs[1]], undefined, today);
  const wd = /^\W*([a-zä]{2,10})\b\.?/.exec(r);
  if (wd && WEEKDAYS[wd[1]] !== undefined && !/\d{1,2}:\d{2}/.test(r.slice(0, 3))) {
    const diff = (today.getDay() - WEEKDAYS[wd[1]] + 7) % 7;
    return addDays(today, -diff);
  }
  return undefined;
}

function pastDate(day: number, month: number, year: string | undefined, today: Date): Date | undefined {
  if (day < 1 || day > 31 || month < 0 || month > 11) return undefined;
  let y = year ? Number(year.length === 2 ? `20${year}` : year) : today.getFullYear();
  let d = new Date(y, month, day);
  if (!year && d > today) d = new Date(--y, month, day);
  return d;
}

/** Brushing duration in seconds: "2:05 min", "2 Min. 5 Sek.", "125 s". */
export function parseDuration(row: string): number | undefined {
  const r = row.toLowerCase();
  const minSec = /\b(\d{1,2})\s*(?:min\.?|minuten|minutes|m)\s*(\d{1,2})\s*(?:sek\.?|sekunden|seconds|sec|s)\b/.exec(r);
  if (minSec) return Number(minSec[1]) * 60 + Number(minSec[2]);
  const clock = /\b([0-4]):([0-5]\d)\b(?!\s*uhr)/.exec(r);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const secs = /\b(\d{2,3})\s*(?:sek\.?|sekunden|seconds|sec|s)\b/.exec(r);
  if (secs && Number(secs[1]) <= 400) return Number(secs[1]);
  const mins = /\b(\d)\s*(?:min\.?|minuten|minutes)\b/.exec(r);
  if (mins) return Number(mins[1]) * 60;
  return undefined;
}

/** Clock time "07:12" or "21:30 Uhr" (hours ≥ 5 so it can't be a duration). */
export function parseClock(row: string): [number, number] | undefined {
  const m = /\b(\d{1,2}):([0-5]\d)\s*(uhr|am|pm)?\b/i.exec(row);
  if (!m) return undefined;
  let h = Number(m[1]);
  const suffix = m[3]?.toLowerCase();
  if (suffix === 'pm' && h < 12) h += 12;
  if (suffix === 'am' && h === 12) h = 0;
  if (h > 23 || (h < 5 && suffix !== 'uhr' && suffix !== 'am')) return undefined;
  return [h, Number(m[2])];
}

export function parseOralBText(rows: string[], now = new Date()): BrushSession[] {
  const sessions: BrushSession[] = [];
  let day: Date | undefined;
  let pendingTime: [number, number] | undefined;
  for (const raw of rows) {
    const row = raw.replace(/\s+/g, ' ').trim();
    if (!row) continue;
    const d = parseDay(row, now);
    if (d) {
      day = d;
      pendingTime = undefined;
    }
    // Remove the clock time before looking for a duration so "07:12" isn't read as 7 min.
    const clock = parseClock(row);
    if (clock) pendingTime = clock;
    const withoutClock = clock ? row.replace(/\b\d{1,2}:[0-5]\d\s*(uhr|am|pm)?/i, ' ') : row;
    const duration = parseDuration(withoutClock);
    const coverage = /(\d{1,3})\s*%/.exec(row);
    const pressure = /(\d+)\s*[x×]?\s*(?:druck|zu fest|pressure|to hard|too hard)/i.exec(row) ?? /(?:druck|pressure)\D{0,12}(\d+)/i.exec(row);

    if (duration !== undefined && duration >= 20) {
      const base = day ?? startOfDay(now);
      const sameDay = sessions.filter((s) => startOfDay(new Date(s.date)).getTime() === base.getTime()).length;
      const [h, m] = pendingTime ?? (sameDay === 0 ? [7, 0] : [21, 0]);
      sessions.push({
        date: new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m).toISOString(),
        durationSec: duration,
        coveragePct: coverage && Number(coverage[1]) <= 100 ? Number(coverage[1]) : undefined,
        pressureWarnings: pressure ? Number(pressure[1]) : undefined,
        source: 'screenshot',
      });
      pendingTime = undefined;
    } else if (sessions.length) {
      // Coverage/pressure on the line after the duration.
      const last = sessions[sessions.length - 1];
      if (coverage && last.coveragePct === undefined && Number(coverage[1]) <= 100) last.coveragePct = Number(coverage[1]);
      if (pressure && last.pressureWarnings === undefined) last.pressureWarnings = Number(pressure[1]);
    }
  }
  return sessions;
}
