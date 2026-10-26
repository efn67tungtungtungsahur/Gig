import { clamp, dayKey, daysBetween, formatMinutes, formatShort, mean } from '../lib/dates';
import { classifyAll, eventDayKey, upcoming } from './calendar';
import { holidayStatus, type HolidayStatus } from './holidays';
import { summarizeLiftoff, type LiftoffSummary } from './liftoff';
import { analyzeOralCare, type OralCareAnalysis } from './oralb';
import { learningPhase, type LearningPhase } from './reminders';
import { analyzeSleep, type SleepAnalysis } from './sleep';
import { abiForecast, blockI, formatPoints, gradeStreak, semesterAverage, semesterForDate, type AbiForecast, type BlockI, type GradeStreak } from './grades';
import { trainingStreak, type TrainingStreak } from './streaks';
import type { AppData, BloodPressure, ClassifiedEvent, Measurement, Semester, Settings, WorkoutEntry } from './types';

export interface AreaScore {
  key: 'schlaf' | 'aktivitaet' | 'koerper' | 'training' | 'zaehne' | 'noten';
  label: string;
  score?: number; // undefined = keine Daten
  summary: string;
}

export interface ActivityAnalysis {
  hasData: boolean;
  avgSteps: number;
  todaySteps?: number;
  goal: number;
  daysGoalReached: number;
  days: number;
  avgActiveCalories?: number;
  avgRestingHr?: number;
  restingHrTrend?: number;
}

export interface BodyAnalysis {
  latestWeight?: Measurement;
  weightChange30?: number;
  latestBodyFat?: Measurement;
  bodyFatChange30?: number;
  latestBp?: BloodPressure;
  bpCategory?: string;
}

export interface TrainingAnalysis {
  plannedLast7: number;
  doneLast7: number;
  nextTraining?: ClassifiedEvent;
  liftoff: LiftoffSummary;
  workouts: WorkoutEntry[];
}

export interface GradesAnalysis {
  semester: Semester;
  average?: number;
  blockI: BlockI;
  forecast: AbiForecast;
  streak: GradeStreak;
}

export interface OverallReport {
  generatedAt: string;
  grades: GradesAnalysis;
  trainingStreak: TrainingStreak;
  overallScore?: number;
  areas: AreaScore[];
  sleep: SleepAnalysis;
  learning: LearningPhase;
  activity: ActivityAnalysis;
  body: BodyAnalysis;
  training: TrainingAnalysis;
  oral: OralCareAnalysis;
  holidays: HolidayStatus;
  exams: ClassifiedEvent[];
  events: ClassifiedEvent[];
  strengths: string[];
  improvements: string[];
  nextDays: string[];
}

function lastNDays<T extends { date: string }>(values: T[], today: Date, n: number): T[] {
  const todayKey = dayKey(today);
  return values.filter((v) => {
    const diff = daysBetween(v.date.slice(0, 10), todayKey);
    return diff >= 0 && diff < n;
  });
}

export function analyzeActivity(data: AppData, settings: Settings, today = new Date()): ActivityAnalysis {
  const goal = settings.training.stepsGoal;
  const todayKey = dayKey(today);
  // Exclude today from averages – it is not over yet.
  const steps = lastNDays(data.health.steps, today, 8).filter((s) => s.date !== todayKey);
  const cals = lastNDays(data.health.activeCalories, today, 8).filter((s) => s.date !== todayKey);
  const rhr = lastNDays(data.health.restingHr, today, 14);
  const rhrRecent = rhr.filter((r) => daysBetween(r.date, todayKey) < 7);
  const rhrBefore = rhr.filter((r) => daysBetween(r.date, todayKey) >= 7);
  return {
    hasData: steps.length > 0,
    avgSteps: Math.round(mean(steps.map((s) => s.value))),
    todaySteps: data.health.steps.find((s) => s.date === todayKey)?.value,
    goal,
    daysGoalReached: steps.filter((s) => s.value >= goal).length,
    days: steps.length,
    avgActiveCalories: cals.length ? Math.round(mean(cals.map((c) => c.value))) : undefined,
    avgRestingHr: rhrRecent.length ? Math.round(mean(rhrRecent.map((r) => r.value))) : undefined,
    restingHrTrend:
      rhrRecent.length && rhrBefore.length ? mean(rhrRecent.map((r) => r.value)) - mean(rhrBefore.map((r) => r.value)) : undefined,
  };
}

function bpCategory(bp: BloodPressure): string {
  if (bp.systolic >= 140 || bp.diastolic >= 90) return 'erhöht (Hypertonie-Bereich)';
  if (bp.systolic >= 130 || bp.diastolic >= 85) return 'hoch-normal';
  if (bp.systolic < 90 || bp.diastolic < 60) return 'niedrig';
  return 'normal';
}

function changeOver(values: Measurement[], today: Date, days: number): number | undefined {
  const sorted = [...values].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  if (!latest) return undefined;
  const cutoff = new Date(today.getTime() - days * 86_400_000).toISOString();
  const base = sorted.filter((v) => v.date <= cutoff).pop() ?? sorted[0];
  if (base === latest) return undefined;
  return latest.value - base.value;
}

export function analyzeBody(data: AppData, today = new Date()): BodyAnalysis {
  const latest = <T extends { date: string }>(arr: T[]) => [...arr].sort((a, b) => a.date.localeCompare(b.date)).pop();
  const latestBp = latest(data.health.bloodPressure);
  return {
    latestWeight: latest(data.health.weight),
    weightChange30: changeOver(data.health.weight, today, 30),
    latestBodyFat: latest(data.health.bodyFat),
    bodyFatChange30: changeOver(data.health.bodyFat, today, 30),
    latestBp,
    bpCategory: latestBp ? bpCategory(latestBp) : undefined,
  };
}

/** Health Connect workouts plus Liftoff workouts, without duplicates. */
export function allWorkouts(data: AppData): WorkoutEntry[] {
  const out = [...data.liftoff.workouts];
  for (const w of data.health.workouts) {
    const t = new Date(w.start).getTime();
    if (!out.some((o) => Math.abs(new Date(o.start).getTime() - t) < 30 * 60_000)) out.push(w);
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

export function buildReport(data: AppData, settings: Settings, now = new Date()): OverallReport {
  const events = classifyAll(data.calendar.events, settings.keywords);
  const todayKey = dayKey(now);
  const sleep = analyzeSleep(data.health.sleep, settings.sleep.goalHours, now);
  const learning = learningPhase(events, now, settings);
  const activity = analyzeActivity(data, settings, now);
  const body = analyzeBody(data, now);
  const workouts = allWorkouts(data);
  const liftoff = summarizeLiftoff(data.liftoff, workouts, now);
  const oral = analyzeOralCare(data.oralb.sessions, now);
  const holidays = holidayStatus(data.holidays.periods, now);
  const exams = upcoming(events, now, ['klausur', 'test'], 60);
  const plannedLast7 = events.filter((e) => {
    const diff = daysBetween(eventDayKey(e), todayKey);
    return e.kind === 'training' && diff >= 0 && diff < 7 && new Date(e.start) <= now;
  }).length;
  const training: TrainingAnalysis = {
    plannedLast7,
    doneLast7: liftoff.workoutsLast7,
    nextTraining: upcoming(events, now, ['training'], 14)[0],
    liftoff,
    workouts,
  };
  const tStreak = trainingStreak(events, workouts, data.trainingLog, now);
  const week = tStreak.sessions.filter((x) => daysBetween(eventDayKey(x.event), todayKey) < 7 && x.status !== 'pending');
  const weekDone = week.filter((x) => x.status === 'done').length;

  const semester = semesterForDate(now, settings.grades.qPhaseStartYear);
  const { subjects, grades: gradeList } = data.grades;
  const b1 = blockI(subjects, gradeList, settings.grades);
  const gradesAnalysis: GradesAnalysis = {
    semester,
    average: semesterAverage(subjects, gradeList, semester, settings.grades),
    blockI: b1,
    forecast: abiForecast(b1),
    streak: gradeStreak(gradeList, events, subjects, settings.grades.streakMin, now),
  };

  const areas: AreaScore[] = [];
  areas.push({
    key: 'schlaf',
    label: 'Schlaf',
    score: sleep.verdict === 'keine-daten' ? undefined : sleep.score,
    summary:
      sleep.verdict === 'keine-daten'
        ? 'Keine Schlafdaten'
        : `Ø ${formatMinutes(sleep.avgAsleepMin)} pro Nacht (Ziel ${settings.sleep.goalHours} h)`,
  });
  areas.push({
    key: 'aktivitaet',
    label: 'Aktivität',
    score: activity.hasData ? Math.round(clamp((activity.avgSteps / activity.goal) * 100, 0, 100)) : undefined,
    summary: activity.hasData ? `Ø ${activity.avgSteps.toLocaleString('de-DE')} Schritte/Tag` : 'Keine Schrittdaten',
  });
  const bodyScore = body.latestBp
    ? body.bpCategory === 'normal'
      ? 90
      : body.bpCategory === 'hoch-normal'
        ? 70
        : 50
    : body.latestWeight
      ? 75
      : undefined;
  areas.push({
    key: 'koerper',
    label: 'Körper',
    score: bodyScore,
    summary: body.latestWeight
      ? `${body.latestWeight.value.toFixed(1).replace('.', ',')} kg${body.weightChange30 !== undefined ? ` (${signed(body.weightChange30, 1)} kg in 30 T.)` : ''}`
      : 'Keine Withings-Daten',
  });
  // Planned trainings that were done (calendar + workouts + manual ticks); without a plan, 3 workouts/week = 100.
  const trainingScore = week.length
    ? Math.round((weekDone / week.length) * 100)
    : workouts.length
      ? Math.round(clamp((training.doneLast7 / 3) * 100, 0, 100))
      : undefined;
  areas.push({
    key: 'training',
    label: 'Training',
    score: trainingScore,
    summary: `${week.length ? `${weekDone}/${week.length} geplante Trainings` : `${training.doneLast7} Workouts`} in 7 Tagen · Serie ${tStreak.current}${
      liftoff.latest?.position ? ` · Platz ${liftoff.latest.position}` : ''
    }`,
  });
  areas.push({
    key: 'zaehne',
    label: 'Zahnpflege',
    score: oral.hasData ? oral.score : undefined,
    summary: oral.hasData
      ? `${oral.sessionsPerDay.toFixed(1).replace('.', ',')}× täglich · Ø ${Math.round(oral.avgDurationSec)} s`
      : 'Keine Oral-B-Daten',
  });

  areas.push({
    key: 'noten',
    label: 'Noten',
    score: gradesAnalysis.average !== undefined ? Math.round((gradesAnalysis.average / 15) * 100) : undefined,
    summary:
      gradesAnalysis.average !== undefined
        ? `Ø ${formatPoints(gradesAnalysis.average)} Punkte im ${semester}. HJ · Serie ${gradesAnalysis.streak.current}`
        : 'Noch keine Noten eingetragen',
  });

  const scored = areas.filter((a) => a.score !== undefined);
  const overallScore = scored.length ? Math.round(mean(scored.map((a) => a.score!))) : undefined;

  const strengths: string[] = [];
  const improvements: string[] = [];
  for (const a of scored) {
    if (a.score! >= 80) strengths.push(`${a.label}: ${a.summary}`);
  }
  if (sleep.shouldImprove) {
    improvements.push(
      learning.active
        ? `Schlaf: ${sleep.headline}. Erinnerungen pausiert (${learning.reason}).`
        : `Schlaf: ${sleep.tips[0] ?? sleep.headline}`,
    );
  }
  if (activity.hasData && activity.avgSteps < activity.goal * 0.8) {
    improvements.push(`Aktivität: ${activity.avgSteps.toLocaleString('de-DE')} statt ${activity.goal.toLocaleString('de-DE')} Schritte – ein 20-min-Spaziergang bringt ca. 2.500 Schritte.`);
  }
  if (week.length > weekDone) {
    improvements.push(`Training: ${week.length - weekDone} geplante Einheit(en) in den letzten 7 Tagen verpasst – im Tab „Training“ kannst du erledigte abhaken.`);
  }
  for (const e of gradesAnalysis.streak.pending.slice(0, 2)) {
    improvements.push(`Noten: Trag die Punkte für ${e.kind === 'klausur' ? 'die Klausur' : 'den Test'} ${e.subject ?? e.title} (${formatShort(eventDayKey(e))}) ein.`);
  }
  if (gradesAnalysis.streak.current >= 2) {
    strengths.push(`Noten-Serie: ${gradesAnalysis.streak.current} Tests/Klausuren in Folge mit ${settings.grades.streakMin}+ Punkten 🔥`);
  }
  if (tStreak.current >= 3) strengths.push(`Trainings-Serie: ${tStreak.current} geplante Trainings in Folge durchgezogen 🔥`);
  if (oral.hasData && oral.score < 80) improvements.push(`Zahnpflege: ${oral.tips[0]}`);
  if (body.latestBp && body.bpCategory !== 'normal') {
    improvements.push(`Blutdruck zuletzt ${body.latestBp.systolic}/${body.latestBp.diastolic} (${body.bpCategory}).`);
  }
  if (liftoff.positionChange && liftoff.positionChange > 0) strengths.push(`Liftoff: ${liftoff.positionChange} Plätze aufgestiegen!`);
  if (liftoff.newAchievements.length) strengths.push(`Neue Errungenschaften: ${liftoff.newAchievements.join(', ')}`);

  const nextDays: string[] = [];
  for (const e of exams.filter((x) => daysBetween(todayKey, eventDayKey(x)) <= 14)) {
    nextDays.push(`${e.kind === 'klausur' ? '📚 Klausur' : '📝 Test'} ${e.subject ?? e.title} – ${formatShort(eventDayKey(e))}`);
  }
  const trainingsNext7 = upcoming(events, now, ['training'], 7);
  if (trainingsNext7.length) nextDays.push(`🏋️ ${trainingsNext7.length} Training(s) in den nächsten 7 Tagen`);
  if (holidays.current) nextDays.push(`🏖️ ${holidays.current.name} – noch ${holidays.currentDaysLeft} Tage`);
  else if (holidays.next) nextDays.push(`🏖️ ${holidays.next.name} in ${holidays.daysUntilNext} Tagen`);

  return {
    generatedAt: now.toISOString(),
    grades: gradesAnalysis,
    trainingStreak: tStreak,
    overallScore,
    areas,
    sleep,
    learning,
    activity,
    body,
    training,
    oral,
    holidays,
    exams,
    events,
    strengths,
    improvements,
    nextDays,
  };
}

export function signed(v: number, digits = 0): string {
  const s = v.toFixed(digits).replace('.', ',');
  return v > 0 ? `+${s}` : s;
}

/** One-line digest used for the weekly notification. */
export function weeklyDigest(r: OverallReport): string {
  const parts: string[] = [];
  if (r.overallScore !== undefined) parts.push(`Gesamt ${r.overallScore}/100`);
  if (r.sleep.verdict !== 'keine-daten') parts.push(`Schlaf Ø ${formatMinutes(r.sleep.avgAsleepMin)}`);
  if (r.activity.hasData) parts.push(`${r.activity.avgSteps.toLocaleString('de-DE')} Schritte/Tag`);
  parts.push(`${r.training.doneLast7} Workouts`);
  const examsSoon = r.exams.filter((e) => daysBetween(new Date(r.generatedAt), eventDayKey(e)) <= 7).length;
  if (examsSoon) parts.push(`${examsSoon} Prüfung(en) diese Woche`);
  return parts.join(' · ');
}
