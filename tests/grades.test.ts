import { describe, expect, it } from 'vitest';
import { classifyAll } from '../src/domain/calendar';
import { defaultSettings, DEFAULT_SUBJECTS } from '../src/domain/defaults';
import {
  abiForecast,
  abiGrade,
  blockI,
  gradeStreak,
  matchSubject,
  semesterAverage,
  semesterForDate,
  subjectAverage,
} from '../src/domain/grades';
import { trainingStreak } from '../src/domain/streaks';
import type { CalEvent, GradeEntry, GradeType, Semester } from '../src/domain/types';

const settings = defaultSettings(new Date(2026, 9, 26)).grades;
let n = 0;
const g = (subjectId: string, points: number, type: GradeType = 'sonstige', date = '2026-10-01', semester: Semester = 1): GradeEntry => ({
  id: `t${n++}`,
  subjectId,
  points,
  type,
  date,
  semester,
});

// Grades from the Notan screenshot (1. Halbjahr).
const notan: GradeEntry[] = [
  g('musik', 15),
  g('englisch', 14),
  g('geschichte', 14),
  g('geschichte', 14),
  g('mathematik', 14),
  g('physik', 13),
  g('chemie', 14),
  g('chemie', 10),
  g('chemie', 12),
  g('deutsch', 12),
];

function ev(title: string, start: Date, minutes = 60, allDay = false): CalEvent {
  return { id: `${title}@${start.toISOString()}`, uid: title, title, start: start.toISOString(), end: new Date(start.getTime() + minutes * 60_000).toISOString(), allDay };
}

describe('grades', () => {
  it('reproduces the Notan average of 13,3 with LKs counting double', () => {
    expect(subjectAverage(DEFAULT_SUBJECTS[5], notan, 1, settings)).toBe(12); // Chemie
    expect(semesterAverage(DEFAULT_SUBJECTS, notan, 1, settings)!.toFixed(1)).toBe('13.3');
  });

  it('applies a Klausur share when configured', () => {
    const grades = [g('chemie', 9, 'klausur'), g('chemie', 15, 'muendlich'), g('chemie', 12, 'test')];
    expect(subjectAverage(DEFAULT_SUBJECTS[5], grades, 1, { ...settings, weighting: 'drittel' })).toBeCloseTo(9 / 3 + (13.5 * 2) / 3);
    expect(subjectAverage({ ...DEFAULT_SUBJECTS[5], klausurShare: 50 }, grades, 1, settings)).toBeCloseTo(11.25);
  });

  it('maps dates to the four Halbjahre of the Qualifikationsphase', () => {
    expect(semesterForDate('2026-10-26', 2026)).toBe(1);
    expect(semesterForDate('2027-01-29', 2026)).toBe(1);
    expect(semesterForDate('2027-02-15', 2026)).toBe(2);
    expect(semesterForDate('2027-09-01', 2026)).toBe(3);
    expect(semesterForDate('2028-03-01', 2026)).toBe(4);
    expect(semesterForDate('2029-01-01', 2026)).toBe(4);
  });

  it('computes Block I like § 30 GOSTV: 8 LK half-years double + 28 Grundkurse, P / 44 × 40', () => {
    const grades: GradeEntry[] = [];
    for (const sem of [1, 2, 3, 4] as Semester[]) {
      grades.push(g('englisch', 14, 'klausur', '2026-10-01', sem), g('chemie', 12, 'klausur', '2026-10-01', sem));
      for (const id of ['musik', 'geschichte', 'mathematik', 'physik', 'deutsch', 'biologie', 'erdkunde']) grades.push(g(id, 13, 'klausur', '2026-10-01', sem));
    }
    const b = blockI(DEFAULT_SUBJECTS, grades, settings);
    expect(b.complete).toBe(true);
    expect(b.weightCount).toBe(44);
    // LK: 4×14×2 + 4×12×2 = 208, GK: 28×13 = 364 → 572 / 44 × 40 = 520
    expect(b.points).toBe(572);
    expect(b.current).toBe(520);
  });

  it('projects Block I and the Abi grade from the current average', () => {
    const b = blockI(DEFAULT_SUBJECTS, notan, settings);
    expect(b.complete).toBe(false);
    const f = abiForecast(b);
    expect(f.blockI).toBeGreaterThan(500);
    expect(f.grade).toBeLessThanOrEqual(1.5);
    expect(abiGrade(800)).toBe(1.2);
    expect(abiGrade(900)).toBe(1.0);
    expect(abiGrade(300)).toBe(4.0);
  });

  it('finds the subject of an exam title', () => {
    expect(matchSubject('Klausur Chemie', DEFAULT_SUBJECTS)?.id).toBe('chemie');
    expect(matchSubject('Mathe', DEFAULT_SUBJECTS)?.id).toBe('mathematik');
    expect(matchSubject('Bio-Test', DEFAULT_SUBJECTS)?.id).toBe('biologie');
    expect(matchSubject('Englisch-Vokabeltest', DEFAULT_SUBJECTS)?.id).toBe('englisch');
  });
});

describe('grade streak', () => {
  const now = new Date(2026, 10, 20, 12);
  const keywords = defaultSettings(now).keywords;

  it('counts tests and Klausuren with 13+ points in a row and ignores other grades', () => {
    const grades = [
      g('chemie', 10, 'klausur', '2026-09-10'),
      g('englisch', 14, 'test', '2026-09-20'),
      g('deutsch', 8, 'muendlich', '2026-09-25'), // oral grade: doesn't count
      g('mathematik', 13, 'klausur', '2026-10-05'),
      g('physik', 15, 'test', '2026-11-02'),
    ];
    const s = gradeStreak(grades, [], DEFAULT_SUBJECTS, 13, now);
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
  });

  it('does not expire with time but follows the exam dates', () => {
    const grades = [g('englisch', 14, 'test', '2026-01-10')];
    // Months later without exams the streak is still alive.
    expect(gradeStreak(grades, [], DEFAULT_SUBJECTS, 13, now).current).toBe(1);
    // An exam without a grade is pending – it neither keeps nor breaks the streak.
    const events = classifyAll([ev('Klausur Chemie', new Date(2026, 10, 18, 8), 90), ev('Test Englisch', new Date(2026, 10, 25, 9))], keywords);
    const s = gradeStreak(grades, events, DEFAULT_SUBJECTS, 13, now);
    expect(s.current).toBe(1);
    expect(s.pending.map((e) => e.subject)).toEqual(['Chemie']);
    expect(s.next?.subject).toBe('Englisch');
    // Once the Klausur is graded below 13 the streak breaks.
    const withGrade = [...grades, g('chemie', 11, 'klausur', '2026-11-18')];
    const after = gradeStreak(withGrade, events, DEFAULT_SUBJECTS, 13, now);
    expect(after.current).toBe(0);
    expect(after.pending).toHaveLength(0);
  });
});

describe('training streak', () => {
  const now = new Date(2026, 10, 20, 12); // Friday
  const keywords = defaultSettings(now).keywords;
  const trainings = classifyAll(
    [
      ev('Gym Push', new Date(2026, 10, 9, 17)),
      ev('Gym Pull', new Date(2026, 10, 11, 17)),
      ev('Beine', new Date(2026, 10, 13, 17)),
      ev('Gym Push', new Date(2026, 10, 16, 17)),
      ev('Gym Pull', new Date(2026, 10, 18, 17)),
      ev('Beine', new Date(2026, 10, 20, 17)), // today, later
      ev('Gym Push', new Date(2026, 10, 23, 17)),
    ],
    keywords,
  );
  const workout = (d: Date) => ({ start: d.toISOString(), end: d.toISOString(), type: 'strength', durationMin: 60 });

  it('counts planned trainings done in a row, rest days do not matter', () => {
    const workouts = [workout(new Date(2026, 10, 11, 17)), workout(new Date(2026, 10, 13, 17)), workout(new Date(2026, 10, 16, 17))];
    const s = trainingStreak(trainings, workouts, { [trainings[4].id]: 'done' }, now);
    // 9.11. missed, then 11., 13., 16. (workouts) and 18. (ticked) done; today is still open.
    expect(s.current).toBe(4);
    expect(s.best).toBe(4);
    expect(s.sessions[0].status).toBe('done');
    expect(s.next?.title).toBe('Beine');
    // After today's training started it is open until the day ends – the streak holds.
    const evening = trainingStreak(trainings, workouts, { [trainings[4].id]: 'done' }, new Date(2026, 10, 20, 19));
    expect(evening.sessions[0].status).toBe('pending');
    expect(evening.current).toBe(4);
  });

  it('breaks on a missed planned training, but not on a cancelled one', () => {
    const s = trainingStreak(trainings, [workout(new Date(2026, 10, 16, 17))], {}, now);
    expect(s.current).toBe(0);
    expect(s.best).toBe(1);
    const cancelled = trainingStreak(trainings, [workout(new Date(2026, 10, 16, 17))], { [trainings[4].id]: 'skipped' }, now);
    expect(cancelled.current).toBe(1);
  });
});
