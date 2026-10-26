import { dayKey } from '../lib/dates';
import { BUNDLED_HOLIDAYS } from './holidays';
import type { AppData, Settings } from './types';

export const LIFTOFF_DEFAULT_API_BASE = 'https://v2-13-10.api.getgymbros.com';

export function defaultSettings(today = new Date()): Settings {
  return {
    icsUrls: [],
    anthropicApiKey: '',
    reminders: {
      enabled: true,
      testOffsets: [7, 3, 2],
      // 2 Wochen, 1 Woche, 3 Tage – und dann wie beim Test (2 Tage).
      klausurOffsets: [14, 7, 3, 2],
      time: '17:00',
    },
    keywords: {
      klausur: ['Klausur', 'Prüfung', 'Abitur'],
      test: ['Test', 'Leistungskontrolle', 'Kontrolle', 'Klassenarbeit', 'Quiz'],
      training: [
        'Training', 'Gym', 'Fitness', 'Workout', 'Krafttraining', 'Push', 'Pull', 'Beine', 'Legs',
        'Oberkörper', 'Unterkörper', 'Ganzkörper', 'Brust', 'Rücken', 'Schultern', 'Arme', 'Cardio',
      ],
      lernen: ['Lernen', 'Lernzeit', 'Lerntag', 'Lernsession', 'Wiederholen', 'Klausurvorbereitung'],
    },
    sleep: {
      goalHours: 8,
      remindersEnabled: true,
      learningPhaseDays: 7,
      pauseForTests: false,
    },
    holidays: {
      biweeklyEnabled: true,
      anchor: dayKey(today),
      time: '08:00',
    },
    weeklyReport: {
      enabled: true,
      weekday: 0,
      time: '18:00',
    },
    training: {
      goal: 'muskelaufbau',
      stepsGoal: 10000,
    },
    liftoff: {
      apiBase: LIFTOFF_DEFAULT_API_BASE,
      email: '',
      refreshToken: '',
    },
    healthConnected: false,
    demoMode: false,
    welcomeDone: false,
  };
}

export function emptyData(): AppData {
  return {
    calendar: { events: [], errors: [] },
    health: {
      sleep: [],
      steps: [],
      activeCalories: [],
      restingHr: [],
      hrv: [],
      weight: [],
      bodyFat: [],
      bloodPressure: [],
      workouts: [],
      sources: [],
    },
    liftoff: { snapshots: [], workouts: [] },
    oralb: { sessions: [] },
    gym: { equipment: [], photosScanned: 0 },
    holidays: { periods: BUNDLED_HOLIDAYS, source: 'eingebaut' },
  };
}

/** Deep-merges stored settings over defaults so new fields get sane values after updates. */
export function mergeSettings(stored: Partial<Settings> | null | undefined, today = new Date()): Settings {
  const d = defaultSettings(today);
  if (!stored) return d;
  return {
    ...d,
    ...stored,
    reminders: { ...d.reminders, ...stored.reminders },
    keywords: { ...d.keywords, ...stored.keywords },
    sleep: { ...d.sleep, ...stored.sleep },
    holidays: { ...d.holidays, ...stored.holidays },
    weeklyReport: { ...d.weeklyReport, ...stored.weeklyReport },
    training: { ...d.training, ...stored.training },
    liftoff: { ...d.liftoff, ...stored.liftoff },
  };
}

export function mergeData(stored: Partial<AppData> | null | undefined): AppData {
  const d = emptyData();
  if (!stored) return d;
  return {
    ...d,
    ...stored,
    calendar: { ...d.calendar, ...stored.calendar },
    health: { ...d.health, ...stored.health },
    liftoff: { ...d.liftoff, ...stored.liftoff },
    oralb: { ...d.oralb, ...stored.oralb },
    gym: { ...d.gym, ...stored.gym },
    holidays: stored.holidays?.periods?.length ? stored.holidays : d.holidays,
  };
}
