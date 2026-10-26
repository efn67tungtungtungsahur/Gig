import { addDays, dayKey, startOfDay } from '../lib/dates';
import { emptyData } from '../domain/defaults';
import { semesterForDate } from '../domain/grades';
import type { AppData, BrushSession, CalEvent, GradeEntry, GradeType, SleepNight, WorkoutEntry } from '../domain/types';

/** Deterministic noise so the demo looks the same on every start. */
function noise(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function at(day: Date, h: number, m = 0): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

function event(title: string, start: Date, minutes: number, allDay = false): CalEvent {
  const end = allDay ? addDays(start, 1) : new Date(start.getTime() + minutes * 60_000);
  return { id: `demo-${title}-${start.toISOString()}`, uid: `demo-${title}`, title, start: start.toISOString(), end: end.toISOString(), allDay, calendar: 'Demo' };
}

/** Realistic sample data so every screen can be explored before connecting accounts. */
export function demoData(now = new Date()): AppData {
  const d = emptyData();
  const today = startOfDay(now);

  // Kalender: Trainings Mo/Mi/Fr, Lernen, ein Test und zwei Klausuren.
  const events: CalEvent[] = [];
  for (let i = -14; i <= 35; i++) {
    const day = addDays(today, i);
    const wd = day.getDay();
    if (wd === 1) events.push(event('Gym – Push', at(day, 17), 75));
    if (wd === 3) events.push(event('Gym – Pull', at(day, 17), 75));
    if (wd === 5) events.push(event('Beintraining', at(day, 16, 30), 60));
    if (wd === 6 && i % 2 === 0) events.push(event('Cardio', at(day, 10), 40));
  }
  events.push(event('Englisch-Test', at(addDays(today, 4), 9, 45), 45));
  events.push(event('Klausur Mathe', addDays(today, 9), 0, true));
  events.push(event('Lernen Mathe', at(addDays(today, 6), 15), 120));
  events.push(event('Lernen Mathe', at(addDays(today, 8), 15), 120));
  events.push(event('Klausur Deutsch', addDays(today, 20), 0, true));
  events.push(event('Bio-Test', at(addDays(today, 16), 8), 45));
  events.push(event('Klausur Chemie', at(addDays(today, -5), 8), 90));
  d.calendar = { events: events.sort((a, b) => a.start.localeCompare(b.start)), syncedAt: now.toISOString(), errors: [] };

  // Gesundheit (Fitbit + Withings).
  const sleep: SleepNight[] = [];
  for (let i = 20; i >= 0; i--) {
    const wake = addDays(today, -i);
    const late = wake.getDay() === 0 || wake.getDay() === 6;
    // Minutes relative to midnight before waking up (negative = previous evening).
    const bedMin = (late ? 60 : -40) + Math.round(noise(i, 1) * 70) - 20;
    const start = new Date(at(wake, 0).getTime() + bedMin * 60_000);
    const end = at(wake, late ? 9 : 6, 25 + Math.round(noise(i, 2) * 20));
    const inBed = Math.round((end.getTime() - start.getTime()) / 60000);
    const awake = 25 + Math.round(noise(i, 3) * 30);
    const asleep = inBed - awake;
    sleep.push({
      date: dayKey(wake),
      start: start.toISOString(),
      end: end.toISOString(),
      minutesInBed: inBed,
      minutesAsleep: asleep,
      deep: Math.round(asleep * (0.12 + noise(i, 4) * 0.06)),
      rem: Math.round(asleep * (0.18 + noise(i, 5) * 0.05)),
      light: 0,
      awake,
      source: 'Fitbit',
    });
    const last = sleep[sleep.length - 1];
    last.light = asleep - (last.deep ?? 0) - (last.rem ?? 0);
  }
  d.health.sleep = sleep;
  for (let i = 29; i >= 0; i--) {
    const day = addDays(today, -i);
    const key = dayKey(day);
    const steps = i === 0 ? 4200 : Math.round(6000 + noise(i, 6) * 7000);
    d.health.steps.push({ date: key, value: steps });
    d.health.activeCalories.push({ date: key, value: Math.round(steps * 0.045) });
    d.health.restingHr.push({ date: key, value: Math.round(58 + noise(i, 7) * 6) });
    d.health.hrv.push({ date: key, value: Math.round(48 + noise(i, 8) * 20) });
    if (i % 2 === 0) {
      d.health.weight.push({ date: at(day, 7, 5).toISOString(), value: Math.round((72.8 - (29 - i) * 0.02 + noise(i, 9) * 0.6) * 10) / 10, source: 'Withings' });
      d.health.bodyFat.push({ date: at(day, 7, 5).toISOString(), value: Math.round((16.5 - (29 - i) * 0.015 + noise(i, 10) * 0.4) * 10) / 10, source: 'Withings' });
    }
    if (i % 5 === 0) {
      d.health.bloodPressure.push({ date: at(day, 7, 10).toISOString(), systolic: Math.round(118 + noise(i, 11) * 10), diastolic: Math.round(74 + noise(i, 12) * 8), source: 'Withings' });
    }
  }
  d.health.sources = ['Fitbit', 'Withings'];
  d.health.syncedAt = now.toISOString();

  // Liftoff.
  const workouts: WorkoutEntry[] = [];
  const pastTrainings = events.filter((e) => e.title.startsWith('Gym') || e.title === 'Beintraining').filter((e) => new Date(e.end) < now);
  pastTrainings.forEach((e, i) => {
    if (i % 5 === 3) return; // ein ausgelassenes Training
    const push = e.title.includes('Push');
    const pull = e.title.includes('Pull');
    workouts.push({
      start: e.start,
      end: e.end,
      type: 'strength',
      durationMin: 70,
      source: 'Liftoff',
      title: e.title,
      exercises: push
        ? [{ name: 'Kurzhantel-Bankdrücken', sets: 4, bestWeight: 26, reps: 9 }, { name: 'Seitheben', sets: 3, bestWeight: 10, reps: 12 }]
        : pull
          ? [{ name: 'Latzug', sets: 4, bestWeight: 60, reps: 10 }, { name: 'Kurzhantel-Curls', sets: 3, bestWeight: 14, reps: 10 }]
          : [{ name: 'Kniebeugen (Langhantel)', sets: 4, bestWeight: 80, reps: 8 }, { name: 'Beinbeuger (Maschine)', sets: 3, bestWeight: 45, reps: 12 }],
    });
  });
  d.liftoff.workouts = workouts;
  // Cardio days were ticked off by hand in the demo.
  for (const e of events) if (e.title === 'Cardio' && new Date(e.end) < now) d.trainingLog[e.id] = 'done';
  d.liftoff.snapshots = [
    {
      date: addDays(now, -9).toISOString(),
      source: 'screenshot',
      rank: 'Silber II',
      position: 14,
      leaderboardName: 'Freunde – Woche',
      xp: 11850,
      level: 23,
      streakDays: 9,
      achievements: [
        { name: '10 Workouts', unlocked: true },
        { name: '7-Tage-Serie', unlocked: true },
        { name: '100 kg bewegt', unlocked: true },
        { name: '30-Tage-Serie', unlocked: false, progress: '9/30' },
      ],
      leaderboard: [],
    },
    {
      date: addDays(now, -1).toISOString(),
      source: 'screenshot',
      rank: 'Gold III',
      position: 9,
      leaderboardName: 'Freunde – Woche',
      leaderboardSize: 25,
      xp: 13420,
      level: 25,
      streakDays: 17,
      achievements: [
        { name: '10 Workouts', unlocked: true },
        { name: '7-Tage-Serie', unlocked: true },
        { name: '100 kg bewegt', unlocked: true },
        { name: 'Frühaufsteher', unlocked: true },
        { name: '30-Tage-Serie', unlocked: false, progress: '17/30' },
        { name: '50 Workouts', unlocked: false, progress: '38/50' },
      ],
      leaderboard: [
        { position: 7, name: 'Lena', score: 2310 },
        { position: 8, name: 'Jonas', score: 2280 },
        { position: 9, name: 'Du', score: 2195, isMe: true },
        { position: 10, name: 'Mia', score: 2050 },
        { position: 11, name: 'Ben', score: 1990 },
      ],
      note: 'Demo-Daten',
    },
  ];
  d.liftoff.syncedAt = now.toISOString();

  // Oral-B iO.
  const sessions: BrushSession[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = addDays(today, -i);
    sessions.push({ date: at(day, 6, 50).toISOString(), durationSec: 120 + Math.round(noise(i, 13) * 25), coveragePct: 88 + Math.round(noise(i, 14) * 10), pressureWarnings: noise(i, 15) > 0.8 ? 1 : 0, source: 'screenshot' });
    if (i > 0 && noise(i, 16) > 0.2) {
      sessions.push({ date: at(day, 22, 15).toISOString(), durationSec: 85 + Math.round(noise(i, 17) * 40), coveragePct: 75 + Math.round(noise(i, 18) * 15), pressureWarnings: 0, source: 'screenshot' });
    }
  }
  d.oralb = { sessions, streakDays: 3, lastImport: now.toISOString() };

  // Noten (fiktive Beispielwerte).
  const startYear = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  const grade = (subjectId: string, points: number, type: GradeType, daysAgo: number): GradeEntry => {
    const date = dayKey(addDays(today, -daysAgo));
    return { id: `demo-${subjectId}-${daysAgo}`, subjectId, points, type, date, semester: semesterForDate(date, startYear) };
  };
  d.grades.grades = [
    grade('mathematik', 12, 'test', 40),
    grade('englisch', 14, 'klausur', 35),
    grade('physik', 13, 'test', 30),
    grade('geschichte', 13, 'muendlich', 28),
    grade('deutsch', 13, 'klausur', 22),
    grade('musik', 15, 'sonstige', 20),
    grade('chemie', 14, 'test', 15),
    grade('biologie', 11, 'muendlich', 12),
    grade('mathematik', 14, 'klausur', 9),
  ];

  d.gym = {
    equipment: ['dumbbells', 'bench', 'incline_bench', 'barbell', 'squat_rack', 'pullup_bar', 'cable_machine', 'lat_pulldown', 'leg_press', 'leg_curl', 'treadmill', 'mat'],
    scannedAt: addDays(now, -3).toISOString(),
    notes: 'Demo: Kleines Studio mit Freihantelbereich und Kabelturm.',
    photosScanned: 2,
  };
  return d;
}
