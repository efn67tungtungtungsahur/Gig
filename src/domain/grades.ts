// Notenpunkte in der gymnasialen Oberstufe (Brandenburg, GOSTV).
//
// - Fachschnitt: Mittelwert der Noten eines Fachs im Halbjahr (wie in Notan), optional
//   mit eigenem Klausur-Anteil (in Brandenburg legt die Lehrkraft die Gewichtung fest,
//   üblich ist z. B. ein Drittel Klausuren).
// - Halbjahresschnitt: Leistungskurse zählen doppelt.
// - Block I (§ 30 GOSTV): alle 8 LK-Halbjahre doppelt + 28 Grundkurs-Halbjahre,
//   E I = P / S × 40 (max. 600, mind. 200). Ältere Fassungen: 30 Grundkurse.
// - Abiturnote nach KMK: N = 5 2/3 − E / 180, nach der ersten Dezimale abgeschnitten.

import { dayKey, daysBetween, fromDayKey, mean } from '../lib/dates';
import { eventDayKey } from './calendar';
import type { ClassifiedEvent, GradeEntry, GradeSettings, GradeType, Semester, Subject } from './types';

export const SEMESTERS: Semester[] = [1, 2, 3, 4];

export const GRADE_TYPE_LABEL: Record<GradeType, string> = {
  klausur: 'Klausur',
  test: 'Test',
  muendlich: 'Mündlich',
  sonstige: 'Sonstige',
};

/** Types that count for the grade streak – the ones with a date in the calendar. */
export const STREAK_TYPES: GradeType[] = ['klausur', 'test'];

/** Which Halbjahr of the Qualifikationsphase a date falls in (1. HJ starts in August). */
export function semesterForDate(date: string | Date, startYear: number): Semester {
  const d = typeof date === 'string' ? fromDayKey(date.slice(0, 10)) : date;
  const monthsSinceStart = (d.getFullYear() - startYear) * 12 + d.getMonth() - 7; // August = 0
  const hj = Math.floor(monthsSinceStart / 6) + 1;
  return Math.min(4, Math.max(1, hj)) as Semester;
}

export function klausurShareFor(subject: Subject, settings: GradeSettings): number | null {
  if (subject.klausurShare !== undefined && subject.klausurShare !== null) return subject.klausurShare / 100;
  if (settings.weighting === 'drittel') return 1 / 3;
  if (settings.weighting === 'haelfte') return 0.5;
  return null; // all grades count the same
}

/** Average points of one subject in one Halbjahr, or undefined without grades. */
export function subjectAverage(subject: Subject, grades: GradeEntry[], semester: Semester, settings: GradeSettings): number | undefined {
  const list = grades.filter((g) => g.subjectId === subject.id && g.semester === semester);
  if (!list.length) return undefined;
  const share = klausurShareFor(subject, settings);
  if (share === null) return mean(list.map((g) => g.points));
  const klausuren = list.filter((g) => g.type === 'klausur').map((g) => g.points);
  const rest = list.filter((g) => g.type !== 'klausur').map((g) => g.points);
  if (!klausuren.length) return mean(rest);
  if (!rest.length) return mean(klausuren);
  return share * mean(klausuren) + (1 - share) * mean(rest);
}

export function subjectWeight(subject: Subject): number {
  return subject.lk ? 2 : 1;
}

/** Halbjahresschnitt – Leistungskurse zählen doppelt (like Notan's "2x"). */
export function semesterAverage(subjects: Subject[], grades: GradeEntry[], semester: Semester, settings: GradeSettings): number | undefined {
  let sum = 0;
  let weight = 0;
  for (const s of subjects) {
    const avg = subjectAverage(s, grades, semester, settings);
    if (avg === undefined) continue;
    sum += avg * subjectWeight(s);
    weight += subjectWeight(s);
  }
  return weight ? sum / weight : undefined;
}

/** "13,3" */
export function formatPoints(v: number | undefined, digits = 1): string {
  return v === undefined ? '–' : v.toFixed(digits).replace('.', ',');
}

/** Kursabschlussnote as whole points (half points round up). */
export function coursePoints(avg: number): number {
  return Math.min(15, Math.max(0, Math.floor(avg + 0.5)));
}

export interface CourseResult {
  subject: Subject;
  semester: Semester;
  points: number;
}

export interface BlockI {
  /** Course results that exist so far. */
  courses: CourseResult[];
  lkCourses: CourseResult[];
  gkCourses: CourseResult[];
  /** Grundkurs results that are counted (best ones, at most the configured number). */
  countedGk: CourseResult[];
  points: number; // P, LK doubled
  weightCount: number; // S, LK doubled
  /** E I from the courses counted so far. */
  current?: number;
  /** E I extrapolated from the current average to the full number of courses. */
  projected?: number;
  complete: boolean;
  lkUnder5: number;
  gkUnder5: number;
  gkNeeded: number;
  lkNeeded: number;
}

export function blockI(subjects: Subject[], grades: GradeEntry[], settings: GradeSettings): BlockI {
  const courses: CourseResult[] = [];
  for (const subject of subjects) {
    for (const semester of SEMESTERS) {
      const avg = subjectAverage(subject, grades, semester, settings);
      if (avg !== undefined) courses.push({ subject, semester, points: coursePoints(avg) });
    }
  }
  const lkCourses = courses.filter((c) => c.subject.lk);
  const gkCourses = courses.filter((c) => !c.subject.lk);
  const lkNeeded = 8;
  const gkNeeded = settings.blockIGrundkurse;
  // Courses with 0 points cannot be brought in; take the best Grundkurse.
  const countedGk = [...gkCourses].filter((c) => c.points > 0).sort((a, b) => b.points - a.points).slice(0, gkNeeded);
  const countedLk = lkCourses.slice(0, lkNeeded);
  const points = countedLk.reduce((s, c) => s + 2 * c.points, 0) + countedGk.reduce((s, c) => s + c.points, 0);
  const weightCount = countedLk.length * 2 + countedGk.length;
  const complete = countedLk.length >= lkNeeded && countedGk.length >= gkNeeded;
  const avg = weightCount ? points / weightCount : undefined;
  return {
    courses,
    lkCourses,
    gkCourses,
    countedGk,
    points,
    weightCount,
    current: complete && avg !== undefined ? Math.round(avg * 40) : undefined,
    projected: avg !== undefined ? Math.round(avg * 40) : undefined,
    complete,
    lkUnder5: lkCourses.filter((c) => c.points < 5).length,
    gkUnder5: countedGk.filter((c) => c.points < 5).length,
    gkNeeded,
    lkNeeded,
  };
}

/** Abiturnote from total points (Block I + Block II, max. 900). */
export function abiGrade(total: number): number {
  if (total >= 823) return 1.0;
  if (total < 300) return 4.0; // below the minimum – not passed
  const n = 17 / 3 - total / 180;
  return Math.min(4, Math.floor(n * 10 + 1e-9) / 10);
}

export interface AbiForecast {
  blockI?: number;
  blockII?: number;
  total?: number;
  grade?: number;
  examPoints?: number;
}

/**
 * Forecast: Block I projected from the current average, Block II assuming the
 * five exam components (each ×4, max. 300) reach `examPoints` (default: current average).
 */
export function abiForecast(b: BlockI, examPoints?: number): AbiForecast {
  if (b.projected === undefined) return {};
  const avg = b.points / b.weightCount;
  const exam = examPoints ?? Math.round(avg);
  const blockII = exam * 4 * 5;
  const total = b.projected + blockII;
  return { blockI: b.projected, blockII, total, grade: abiGrade(total), examPoints: exam };
}

/** Points → classic grade, e.g. 13 → "1-", 11 → "2". */
export function pointsToGrade(points: number): string {
  const p = Math.round(points);
  if (p <= 0) return '6';
  const table = ['6', '5-', '5', '5+', '4-', '4', '4+', '3-', '3', '3+', '2-', '2', '2+', '1-', '1', '1+'];
  return table[Math.min(15, p)];
}

// ---------- Streak ----------

export interface GradeStreak {
  current: number;
  best: number;
  /** Tests/Klausuren from the calendar that are over but have no grade yet. */
  pending: ClassifiedEvent[];
  lastBreak?: GradeEntry;
  next?: ClassifiedEvent;
}

/** Grade entered for a calendar exam (linked, or same subject keyword on the same day). */
export function gradeForEvent(ev: ClassifiedEvent, grades: GradeEntry[], subjects: Subject[]): GradeEntry | undefined {
  const linked = grades.find((g) => g.eventId === ev.id);
  if (linked) return linked;
  const day = eventDayKey(ev);
  const subj = matchSubject(ev.subject ?? ev.title, subjects);
  return grades.find((g) => g.date === day && STREAK_TYPES.includes(g.type) && (!subj || g.subjectId === subj.id));
}

/** Finds the subject an exam title refers to ("Klausur Chemie" → Chemie, "Mathe" → Mathematik). */
export function matchSubject(text: string, subjects: Subject[]): Subject | undefined {
  const t = text.toLocaleLowerCase('de-DE');
  return (
    subjects.find((s) => t.includes(s.name.toLocaleLowerCase('de-DE'))) ??
    subjects.find((s) => {
      const name = s.name.toLocaleLowerCase('de-DE');
      return t.split(/[^a-zäöüß]+/).some((w) => w.length >= 3 && (name.startsWith(w) || w.startsWith(name.slice(0, 4))));
    })
  );
}

/**
 * Counts tests and Klausuren in a row with at least `min` points. The streak
 * never expires with time – only the next graded test/Klausur decides.
 */
export function gradeStreak(grades: GradeEntry[], events: ClassifiedEvent[], subjects: Subject[], min: number, now = new Date()): GradeStreak {
  const assessed = grades
    .filter((g) => STREAK_TYPES.includes(g.type))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let run = 0;
  let best = 0;
  let lastBreak: GradeEntry | undefined;
  for (const g of assessed) {
    if (g.points >= min) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
      lastBreak = g;
    }
  }
  const todayKey = dayKey(now);
  const exams = events.filter((e) => e.kind === 'klausur' || e.kind === 'test');
  const pending = exams
    .filter((e) => {
      const diff = daysBetween(eventDayKey(e), todayKey);
      const over = diff > 0 || (diff === 0 && !e.allDay && new Date(e.end) <= now);
      return over && diff <= 60 && !gradeForEvent(e, grades, subjects);
    })
    .sort((a, b) => a.start.localeCompare(b.start));
  const next = exams
    .filter((e) => daysBetween(todayKey, eventDayKey(e)) >= 0 && new Date(e.end) > now)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  return { current: run, best, pending, lastBreak, next };
}

export function newGradeId(): string {
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
