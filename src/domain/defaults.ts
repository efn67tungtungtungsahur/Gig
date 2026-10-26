import { dayKey } from '../lib/dates';
import { BUNDLED_HOLIDAYS } from './holidays';
import type { AppData, Settings, Subject } from './types';

/** The subjects from the Notan screenshot – Englisch and Chemie are the Leistungskurse. */
export const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'musik', name: 'Musik', lk: false },
  { id: 'englisch', name: 'Englisch', lk: true },
  { id: 'geschichte', name: 'Geschichte', lk: false },
  { id: 'mathematik', name: 'Mathematik', lk: false },
  { id: 'physik', name: 'Physik', lk: false },
  { id: 'chemie', name: 'Chemie', lk: true },
  { id: 'deutsch', name: 'Deutsch', lk: false },
  { id: 'biologie', name: 'Biologie', lk: false },
  { id: 'erdkunde', name: 'Erdkunde', lk: false },
  { id: 'sport', name: 'Sport', lk: false },
  { id: 'politik', name: 'Politik', lk: false },
  { id: 'seminarkurs', name: 'Seminarkurs', lk: false },
];

/** School year in which a date's Qualifikationsphase would have started (August cut-over). */
function schoolYearStart(d: Date): number {
  return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
}

export const LIFTOFF_DEFAULT_API_BASE = 'https://v2-13-10.api.getgymbros.com';

export function defaultSettings(today = new Date()): Settings {
  return {
    icsUrls: [],
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
      rankStandard: 'm',
      bodyWeightKg: null,
    },
    liftoff: {
      apiBase: LIFTOFF_DEFAULT_API_BASE,
      email: '',
      refreshToken: '',
    },
    grades: {
      qPhaseStartYear: schoolYearStart(today),
      weighting: 'gleich',
      blockIGrundkurse: 28,
      streakMin: 13,
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
      distance: [],
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
    grades: { subjects: DEFAULT_SUBJECTS.map((s) => ({ ...s })), grades: [] },
    trainingLog: {},
    workoutLog: [],
    activeWorkout: null,
    rankTests: [],
    activity: { days: {}, runs: [] },
  };
}

/** Deep-merges stored settings over defaults so new fields get sane values after updates. */
export function mergeSettings(stored: Partial<Settings> | null | undefined, today = new Date()): Settings {
  const d = defaultSettings(today);
  if (!stored) return d;
  // Older versions stored an AI API key – it is no longer used and gets dropped.
  const { anthropicApiKey: _unused, ...rest } = stored as Partial<Settings> & { anthropicApiKey?: string };
  return {
    ...d,
    ...rest,
    reminders: { ...d.reminders, ...rest.reminders },
    keywords: { ...d.keywords, ...rest.keywords },
    sleep: { ...d.sleep, ...rest.sleep },
    holidays: { ...d.holidays, ...rest.holidays },
    weeklyReport: { ...d.weeklyReport, ...rest.weeklyReport },
    training: { ...d.training, ...rest.training },
    liftoff: { ...d.liftoff, ...rest.liftoff },
    grades: { ...d.grades, ...rest.grades },
  };
}

export function mergeData(stored: Partial<AppData> | null | undefined): AppData {
  const d = emptyData();
  if (!stored) return d;
  const { aiSummary: _unused, ...rest } = stored as Partial<AppData> & { aiSummary?: unknown };
  return {
    ...d,
    ...rest,
    calendar: { ...d.calendar, ...rest.calendar },
    health: { ...d.health, ...rest.health },
    liftoff: { ...d.liftoff, ...rest.liftoff },
    oralb: { ...d.oralb, ...rest.oralb },
    gym: { ...d.gym, ...rest.gym },
    holidays: rest.holidays?.periods?.length ? rest.holidays : d.holidays,
    grades: { ...d.grades, ...rest.grades },
    trainingLog: { ...rest.trainingLog },
    workoutLog: rest.workoutLog ?? [],
    activeWorkout: rest.activeWorkout ?? null,
    rankTests: rest.rankTests ?? [],
    activity: { days: { ...rest.activity?.days }, runs: rest.activity?.runs ?? [] },
  };
}
