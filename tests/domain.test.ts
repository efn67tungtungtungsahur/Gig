import { describe, expect, it } from 'vitest';
import { classifyEvent, parseFocus, parseIcs, classifyAll } from '../src/domain/calendar';
import { defaultSettings, emptyData } from '../src/domain/defaults';
import { biweeklyDates, BUNDLED_HOLIDAYS, holidayMessage, holidayStatus } from '../src/domain/holidays';
import { postsToWorkouts, parseLiftoffDuration } from '../src/domain/liftoff';
import { buildNotificationPlan } from '../src/domain/notificationPlan';
import { analyzeOralCare } from '../src/domain/oralb';
import { planTraining } from '../src/domain/planner';
import { examReminders, learningPhase } from '../src/domain/reminders';
import { buildReport } from '../src/domain/report';
import { analyzeSleep } from '../src/domain/sleep';
import type { CalEvent, SleepNight } from '../src/domain/types';
import { dayKey, daysBetween, easterSunday, relativeDays } from '../src/lib/dates';

const settings = defaultSettings(new Date(2026, 9, 26));

function ev(title: string, start: Date, minutes = 60, allDay = false): CalEvent {
  return {
    id: `${title}@${start.toISOString()}`,
    uid: title,
    title,
    start: start.toISOString(),
    end: new Date(start.getTime() + minutes * 60_000).toISOString(),
    allDay,
  };
}

describe('dates', () => {
  it('counts calendar days across DST changes', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2); // DST ends 25.10.2026
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });
  it('formats relative days in German', () => {
    expect(relativeDays(2)).toBe('übermorgen');
    expect(relativeDays(14)).toBe('in 2 Wochen');
    expect(relativeDays(7)).toBe('in 1 Woche');
    expect(relativeDays(3)).toBe('in 3 Tagen');
  });
  it('computes Easter', () => {
    expect(dayKey(easterSunday(2027))).toBe('2027-03-28');
  });
});

describe('Brandenburg holidays', () => {
  it('knows we are in the Herbstferien on 26.10.2026 and counts to Christmas', () => {
    const s = holidayStatus(BUNDLED_HOLIDAYS, '2026-10-26');
    expect(s.current?.name).toBe('Herbstferien');
    expect(s.currentDaysLeft).toBe(5);
    expect(s.backToSchool).toBe('2026-11-02');
    expect(s.next?.name).toBe('Weihnachtsferien');
    expect(s.daysUntilNext).toBe(58);
  });
  it('counts school days without weekends and Feiertage', () => {
    const s = holidayStatus(BUNDLED_HOLIDAYS, '2026-11-02');
    // 02.11.–22.12.2026: 7 weeks + 2 days = 37 weekdays, no Feiertage in between.
    expect(s.schoolDaysUntilNext).toBe(37);
  });
  it('writes the biweekly message', () => {
    const msg = holidayMessage(BUNDLED_HOLIDAYS, '2026-11-09');
    expect(msg.title).toBe('🏖️ Noch 44 Tage bis zu den Weihnachtsferien');
  });
  it('schedules every 14 days from the anchor', () => {
    const dates = biweeklyDates('2026-10-26', new Date(2026, 10, 1), new Date(2026, 11, 31));
    expect(dates).toEqual(['2026-11-09', '2026-11-23', '2026-12-07', '2026-12-21']);
  });
});

describe('calendar', () => {
  it('classifies exams, tests, trainings and learning sessions', () => {
    const now = new Date(2026, 10, 2, 9);
    expect(classifyEvent(ev('Klausur Mathe', now), settings.keywords)).toMatchObject({ kind: 'klausur', subject: 'Mathe' });
    expect(classifyEvent(ev('Englisch-Test', now), settings.keywords)).toMatchObject({ kind: 'test', subject: 'Englisch' });
    expect(classifyEvent(ev('Vokabeltest Latein', now), settings.keywords).kind).toBe('test');
    expect(classifyEvent(ev('Lernen Bio', now), settings.keywords).kind).toBe('lernen');
    expect(classifyEvent(ev('Gym – Push', now), settings.keywords)).toMatchObject({ kind: 'training' });
    expect(classifyEvent(ev('Zahnarzt', now), settings.keywords).kind).toBe('other');
  });
  it('parses training focus', () => {
    expect(parseFocus('Gym Push')).toEqual(['brust', 'schultern', 'trizeps']);
    expect(parseFocus('Beintraining')).toContain('beine');
    expect(parseFocus('Powerlifting')).not.toContain('po');
    expect(parseFocus('Training')).toContain('ruecken');
  });
  it('parses an ICS feed with recurrence, exceptions and all-day events', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'X-WR-CALNAME:Schule',
      'BEGIN:VEVENT',
      'UID:train-1',
      'DTSTART:20261102T160000Z',
      'DTEND:20261102T170000Z',
      'RRULE:FREQ=WEEKLY;COUNT=4',
      'SUMMARY:Training Push',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:train-1',
      'RECURRENCE-ID:20261109T160000Z',
      'DTSTART:20261110T160000Z',
      'DTEND:20261110T170000Z',
      'SUMMARY:Training Push (verschoben)',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:exam-1',
      'DTSTART;VALUE=DATE:20261112',
      'DTEND;VALUE=DATE:20261113',
      'SUMMARY:Klausur Deutsch',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const events = parseIcs(ics, undefined, new Date(2026, 9, 26));
    const trainings = events.filter((e) => e.uid === 'train-1');
    expect(trainings).toHaveLength(4);
    expect(trainings.some((e) => e.title === 'Training Push (verschoben)' && e.start.startsWith('2026-11-10'))).toBe(true);
    const exam = events.find((e) => e.uid === 'exam-1')!;
    expect(exam.allDay).toBe(true);
    expect(dayKey(new Date(exam.start))).toBe('2026-11-12');
    expect(exam.calendar).toBe('Schule');
  });
});

describe('exam reminders', () => {
  const now = new Date(2026, 9, 26, 12);
  const events = classifyAll(
    [ev('Klausur Mathe', new Date(2026, 10, 16, 8), 90), ev('Test Englisch', new Date(2026, 10, 5, 10), 45)],
    settings.keywords,
  );

  it('reminds 14, 7, 3 and 2 days before a Klausur', () => {
    const r = examReminders(events, settings, now).filter((x) => x.kind === 'klausur');
    expect(r.map((x) => x.offsetDays)).toEqual([14, 7, 3, 2]);
    expect(dayKey(r[0].at)).toBe('2026-11-02');
    expect(r[0].at.getHours()).toBe(17);
    expect(r[0].title).toBe('📚 Klausur in 2 Wochen: Mathe');
    expect(r[3].title).toBe('📚 Klausur übermorgen: Mathe');
  });
  it('reminds 7, 3 and 2 days before a test and drops past reminders', () => {
    const r = examReminders(events, settings, now).filter((x) => x.kind === 'test');
    // Test on 05.11.: the 7-day reminder (29.10.) is still ahead, so all three remain.
    expect(r.map((x) => x.offsetDays)).toEqual([7, 3, 2]);
    const later = examReminders(events, settings, new Date(2026, 10, 2, 18)).filter((x) => x.kind === 'test');
    expect(later.map((x) => x.offsetDays)).toEqual([2]);
  });
  it('detects the learning phase before a Klausur', () => {
    expect(learningPhase(events, '2026-11-12', settings).active).toBe(true);
    expect(learningPhase(events, '2026-11-02', settings).active).toBe(false);
    // Tests only pause sleep reminders when enabled.
    expect(learningPhase(events, '2026-11-03', settings).active).toBe(false);
    const withTests = { ...settings, sleep: { ...settings.sleep, pauseForTests: true } };
    expect(learningPhase(events, '2026-11-03', withTests).active).toBe(true);
  });
});

function night(date: string, bed: string, wake: string, asleep: number): SleepNight {
  const [y, m, d] = date.split('-').map(Number);
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  const start = new Date(y, m - 1, bh >= 12 ? d - 1 : d, bh, bm);
  const end = new Date(y, m - 1, d, wh, wm);
  return {
    date,
    start: start.toISOString(),
    end: end.toISOString(),
    minutesInBed: Math.round((end.getTime() - start.getTime()) / 60000),
    minutesAsleep: asleep,
  };
}

describe('sleep analysis', () => {
  it('flags too little sleep and recommends a bedtime', () => {
    const nights = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'].map(
      (d) => night(d, '00:30', '06:30', 340),
    );
    const a = analyzeSleep(nights, 8, new Date(2026, 9, 26, 12));
    expect(a.shouldImprove).toBe(true);
    expect(a.verdict).toBe('verbessern');
    expect(a.recommendedBedtime).toBe('22:15');
  });
  it('is happy with enough regular sleep', () => {
    const nights = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'].map((d) =>
      night(d, '22:15', '06:45', 490),
    );
    const a = analyzeSleep(nights, 8, new Date(2026, 9, 26, 12));
    expect(a.verdict).toBe('gut');
    expect(a.shouldImprove).toBe(false);
  });
});

describe('notification plan', () => {
  it('skips sleep reminders in the learning phase but keeps exam reminders', () => {
    const now = new Date(2026, 9, 26, 12);
    const data = emptyData();
    data.health.sleep = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'].map((d) =>
      night(d, '00:30', '06:30', 330),
    );
    data.calendar.events = [ev('Klausur Mathe', new Date(2026, 9, 30, 8), 90)];
    const report = buildReport(data, settings, now);
    const plan = buildNotificationPlan(data, settings, report, now);
    const sleepDays = plan.filter((p) => p.channel === 'schlaf').map((p) => dayKey(p.at));
    // Klausur on 30.10. → learning phase until then; reminders resume from 31.10.
    expect(sleepDays.every((d) => d >= '2026-10-31')).toBe(true);
    expect(sleepDays.length).toBeGreaterThan(0);
    expect(plan.filter((p) => p.channel === 'pruefungen').map((p) => dayKey(p.at))).toEqual(['2026-10-27', '2026-10-28']);
    expect(plan.some((p) => p.channel === 'ferien')).toBe(true);
    expect(plan.filter((p) => p.channel === 'bericht')).toHaveLength(1);
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
  });
});

describe('training planner', () => {
  it('suggests chest/shoulder/triceps exercises for a push day with the scanned equipment', () => {
    const plan = planTraining(
      { title: 'Gym Push', start: new Date(2026, 10, 2, 17).toISOString(), end: new Date(2026, 10, 2, 18).toISOString(), focus: ['brust', 'schultern', 'trizeps'] },
      ['dumbbells', 'bench', 'cable_machine'],
      'muskelaufbau',
    );
    expect(plan.exercises.length).toBe(6);
    expect(plan.exercises[0].exercise.muscles[0]).toBe('brust');
    for (const p of plan.exercises) {
      expect(p.exercise.muscles.some((m) => ['brust', 'schultern', 'trizeps'].includes(m))).toBe(true);
      expect(p.exercise.needs.flat().every((n) => ['dumbbells', 'bench', 'incline_bench', 'cable_machine', 'resistance_bands', 'weight_plates', 'plyo_box', 'pec_deck', 'ez_bar', 'barbell'].includes(n))).toBe(true);
    }
  });
  it('falls back to bodyweight without equipment', () => {
    const plan = planTraining(
      { title: 'Training', start: new Date(2026, 10, 2, 17).toISOString(), end: new Date(2026, 10, 2, 17, 45).toISOString() },
      [],
      'fitness',
    );
    expect(plan.exercises.length).toBeGreaterThan(2);
    expect(plan.exercises.every((p) => p.exercise.needs.length === 0)).toBe(true);
  });
});

describe('Liftoff & Oral-B', () => {
  it('parses Liftoff durations and posts', () => {
    expect(parseLiftoffDuration('01 hours 06 minutes 01 seconds')).toBe(66);
    expect(parseLiftoffDuration('45 minutes 30 seconds')).toBe(46);
    const w = postsToWorkouts([
      {
        startedAt: '2026-10-20T16:00:00Z',
        sessionDuration: '00 hours 55 minutes 00 seconds',
        exerciseData: [{ exerciseName: 'Bench Press', setsData: [{ inputOne: '60', inputTwo: '10' }, { inputOne: 70, inputTwo: 8 }] }],
      },
    ]);
    expect(w[0].durationMin).toBe(55);
    expect(w[0].exercises?.[0]).toMatchObject({ name: 'Bench Press', sets: 2, bestWeight: 70, reps: 10 });
  });
  it('rates brushing habits', () => {
    const today = new Date(2026, 9, 26, 21);
    const sessions = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(2026, 9, 26 - i);
      sessions.push({ date: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 7).toISOString(), durationSec: 125, coveragePct: 95, source: 'manual' as const });
      sessions.push({ date: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 21).toISOString(), durationSec: 90, coveragePct: 80, source: 'manual' as const });
    }
    const a = analyzeOralCare(sessions, today);
    expect(a.sessionsPerDay).toBe(2);
    expect(a.streakDays).toBe(7);
    expect(a.tips.some((t) => t.includes('2 Minuten'))).toBe(true);
  });
});
