// Shared data model for everything the app stores and displays.

export type EventKind = 'klausur' | 'test' | 'training' | 'lernen' | 'other';

export interface CalEvent {
  /** Unique per occurrence (uid + start). */
  id: string;
  uid: string;
  title: string;
  /** ISO timestamp of the start. All-day events start at local midnight. */
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  description?: string;
  calendar?: string;
}

export interface ClassifiedEvent extends CalEvent {
  kind: EventKind;
  /** For exams: subject guessed from the title ("Mathe"). */
  subject?: string;
  /** For trainings: muscle focus parsed from the title. */
  focus?: MuscleGroup[];
}

export type MuscleGroup =
  | 'brust'
  | 'ruecken'
  | 'schultern'
  | 'bizeps'
  | 'trizeps'
  | 'beine'
  | 'po'
  | 'beinbeuger'
  | 'waden'
  | 'core'
  | 'cardio';

export interface DayValue {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface SleepNight {
  /** Day the night ended (wake-up day), YYYY-MM-DD. */
  date: string;
  start: string; // ISO
  end: string; // ISO
  minutesInBed: number;
  minutesAsleep: number;
  deep?: number;
  rem?: number;
  light?: number;
  awake?: number;
  source?: string;
}

export interface Measurement {
  date: string; // ISO timestamp
  value: number;
  source?: string;
}

export interface BloodPressure {
  date: string; // ISO timestamp
  systolic: number;
  diastolic: number;
  source?: string;
}

export interface WorkoutEntry {
  start: string;
  end: string;
  type: string;
  durationMin: number;
  calories?: number;
  source?: string;
  title?: string;
  exercises?: { name: string; sets: number; bestWeight?: number; reps?: number }[];
  /** Distance of runs and walks (Health Connect). */
  distanceKm?: number;
}

export interface HealthData {
  /** One main night per day (see mainNights). */
  sleep: SleepNight[];
  /** Every sleep session from every source (Fitbit, Withings …). */
  sleepSessions?: SleepNight[];
  /** Daily steps for the last year. */
  steps: DayValue[];
  /** Daily distance in km for the last year. */
  distance: DayValue[];
  activeCalories: DayValue[];
  restingHr: DayValue[];
  hrv: DayValue[];
  weight: Measurement[];
  bodyFat: Measurement[];
  bloodPressure: BloodPressure[];
  workouts: WorkoutEntry[];
  sources: string[];
  syncedAt?: string;
  error?: string;
}

export interface LiftoffAchievement {
  name: string;
  unlocked: boolean;
  progress?: string;
  date?: string;
}

export interface LeaderboardEntry {
  position: number;
  name: string;
  score?: number;
  isMe?: boolean;
}

export interface LiftoffSnapshot {
  date: string; // ISO
  source: 'screenshot' | 'manual' | 'api';
  rank?: string; // Liga/Rang, e.g. "Gold III"
  position?: number; // Platz in der Rangliste
  leaderboardName?: string;
  leaderboardSize?: number;
  xp?: number;
  level?: number;
  streakDays?: number;
  achievements: LiftoffAchievement[];
  leaderboard: LeaderboardEntry[];
  note?: string;
}

export interface LiftoffData {
  snapshots: LiftoffSnapshot[];
  workouts: WorkoutEntry[];
  syncedAt?: string;
  error?: string;
}

export interface BrushSession {
  date: string; // ISO
  durationSec: number;
  coveragePct?: number;
  pressureWarnings?: number;
  score?: number;
  source: 'manual' | 'screenshot';
}

export interface OralBData {
  sessions: BrushSession[];
  streakDays?: number;
  lastImport?: string;
}

export interface GymData {
  equipment: string[];
  /** Last time the equipment list was changed. */
  scannedAt?: string;
  notes?: string;
  photosScanned: number;
}

export interface HolidayPeriod {
  name: string;
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
}

export interface HolidayData {
  periods: HolidayPeriod[];
  source: 'eingebaut' | 'online';
  updatedAt?: string;
}

export interface CalendarData {
  events: CalEvent[];
  syncedAt?: string;
  errors: string[];
}

export type GradeType = 'klausur' | 'test' | 'muendlich' | 'sonstige';
export type Semester = 1 | 2 | 3 | 4;

export interface Subject {
  id: string;
  name: string;
  /** Leistungskurs – counts double. */
  lk: boolean;
  /** Own share of Klausuren in percent; null/undefined = global setting. */
  klausurShare?: number | null;
}

export interface GradeEntry {
  id: string;
  subjectId: string;
  points: number; // 0–15
  type: GradeType;
  date: string; // YYYY-MM-DD
  semester: Semester;
  /** Calendar exam this grade belongs to. */
  eventId?: string;
  note?: string;
}

export interface GradesData {
  subjects: Subject[];
  grades: GradeEntry[];
}

export interface GradeSettings {
  /** Calendar year in which the 1. Halbjahr of the Qualifikationsphase starts (August). */
  qPhaseStartYear: number;
  /** gleich = all grades count the same (like Notan); drittel/haelfte = share of Klausuren. */
  weighting: 'gleich' | 'drittel' | 'haelfte';
  /** Grundkurs half-years counted in Block I (GOSTV: 28; older versions 30). */
  blockIGrundkurse: number;
  /** Minimum points that keep the grade streak alive. */
  streakMin: number;
}

export interface LoggedSet {
  weight: number | null; // kg
  reps: number | null;
  done: boolean;
}

export interface LoggedExercise {
  id: string;
  /** Catalogue id (exercises.ts); free exercises only have a name. */
  exerciseId?: string;
  name: string;
  targetSets?: number;
  targetReps?: string;
  restSec?: number;
  sets: LoggedSet[];
  note?: string;
}

/** A training recorded in the app. */
export interface LoggedWorkout {
  id: string;
  start: string; // ISO
  end?: string; // ISO – missing while the workout is running
  title: string;
  /** Planned calendar training this workout belongs to. */
  eventId?: string;
  exercises: LoggedExercise[];
  note?: string;
}

/** Kept forever so badges survive beyond the synced window. */
export interface ActivityArchive {
  days: Record<string, { steps?: number; km?: number }>;
  runs: { start: string; km?: number; min: number }[];
}

/** A result entered in the rank calculator (counts for the ranks, not for load). */
export interface RankTest {
  id: string;
  date: string; // ISO
  exerciseId: string;
  weight: number; // kg (extra weight for body-weight exercises)
  reps: number;
}

/** Manual status of a planned training (calendar event id → status). Abgesagt = counts neither way. */
export type TrainingLog = Record<string, 'done' | 'missed' | 'skipped'>;

export interface AppData {
  calendar: CalendarData;
  health: HealthData;
  liftoff: LiftoffData;
  oralb: OralBData;
  gym: GymData;
  holidays: HolidayData;
  grades: GradesData;
  trainingLog: TrainingLog;
  /** Finished workouts recorded in the app. */
  workoutLog: LoggedWorkout[];
  /** The workout currently being recorded (survives closing the app). */
  activeWorkout: LoggedWorkout | null;
  /** Saved rank calculator results. */
  rankTests: RankTest[];
  /** Daily steps/distance and runs, merged on every sync (for badges). */
  activity: ActivityArchive;
}

export type TrainingGoal = 'muskelaufbau' | 'kraft' | 'ausdauer' | 'fitness';

export interface Settings {
  icsUrls: string[];
  reminders: {
    enabled: boolean;
    testOffsets: number[];
    klausurOffsets: number[];
    time: string; // HH:MM
  };
  keywords: {
    klausur: string[];
    test: string[];
    training: string[];
    lernen: string[];
  };
  sleep: {
    goalHours: number;
    remindersEnabled: boolean;
    /** Days before a Klausur that count as learning phase (no sleep reminders). */
    learningPhaseDays: number;
    /** Also pause sleep reminders before tests, not only Klausuren. */
    pauseForTests: boolean;
    /** Source that wins when several record the same night ('auto' = longest sleep). */
    source: string;
  };
  holidays: {
    biweeklyEnabled: boolean;
    anchor: string; // YYYY-MM-DD, first update day
    time: string;
  };
  weeklyReport: {
    enabled: boolean;
    weekday: number; // 0 = Sonntag
    time: string;
  };
  training: {
    goal: TrainingGoal;
    stepsGoal: number;
    /** Strength standards used for the muscle ranks. */
    rankStandard: 'm' | 'w';
    /** Own body weight when no Withings weight is available. */
    bodyWeightKg: number | null;
  };
  liftoff: {
    apiBase: string;
    email: string;
    refreshToken: string;
  };
  grades: GradeSettings;
  healthConnected: boolean;
  demoMode: boolean;
  welcomeDone: boolean;
}
