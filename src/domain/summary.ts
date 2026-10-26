import { daysBetween, formatMinutes, formatShort, relativeDays } from '../lib/dates';
import { eventDayKey } from './calendar';
import type { OverallReport } from './report';
import type { Settings } from './types';

export interface CoachSummary {
  text: string;
  steps: string[];
}

/** Written overall assessment with three next steps – generated on the phone, no AI service. */
export function buildSummary(r: OverallReport, settings: Settings, now = new Date()): CoachSummary {
  const parts: string[] = [];
  const scored = r.areas.filter((a) => a.score !== undefined);

  if (r.overallScore === undefined) {
    return {
      text: 'Noch sind keine Daten verbunden. Sobald Kalender, Health Connect, Liftoff oder Oral-B dabei sind, bekommst du hier deine Auswertung.',
      steps: ['Verbinde in den Einstellungen deinen Google Kalender.', 'Verbinde Fitbit und Withings über Health Connect.', 'Scanne deinen Trainingsraum im Tab „Training“.'],
    };
  }

  const tone =
    r.overallScore >= 80 ? 'Insgesamt läuft es richtig gut' : r.overallScore >= 60 ? 'Insgesamt eine solide Woche' : 'Diese Woche ist noch Luft nach oben';
  parts.push(`${tone} – dein Gesamt-Score liegt bei ${r.overallScore} von 100.`);

  if (scored.length >= 2) {
    const sorted = [...scored].sort((a, b) => b.score! - a.score!);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best.score! - worst.score! >= 10) {
      parts.push(`Am stärksten ist ${best.label} (${best.score}), am meisten Potenzial hat ${worst.label} (${worst.score}).`);
    }
  }

  const s = r.sleep;
  if (s.verdict !== 'keine-daten') {
    if (r.learning.active) {
      parts.push(`Du bist gerade in der Lernphase (${r.learning.reason?.replace(/^Lernphase: /, '')}), deshalb gibt es keine Schlaf-Erinnerungen.`);
    } else if (s.shouldImprove) {
      parts.push(`Du schläfst im Schnitt ${formatMinutes(s.avgAsleepMin)} und damit weniger als dein Ziel von ${settings.sleep.goalHours} Stunden.`);
    } else {
      parts.push(`Mit durchschnittlich ${formatMinutes(s.avgAsleepMin)} Schlaf bist du gut erholt.`);
    }
  }

  const lift = r.training.liftoff;
  if (lift.positionChange && lift.positionChange > 0 && lift.latest?.position) {
    parts.push(`In Liftoff bist du ${lift.positionChange} Plätze auf Platz ${lift.latest.position} geklettert.`);
  } else if (r.training.doneLast7 > 0) {
    parts.push(`Du hast in den letzten 7 Tagen ${r.training.doneLast7} Workout${r.training.doneLast7 === 1 ? '' : 's'} gemacht.`);
  }
  if (lift.newAchievements.length) parts.push(`Neu freigeschaltet: ${lift.newAchievements.join(', ')}.`);

  const nextExam = r.exams[0];
  if (nextExam) {
    const d = daysBetween(now, eventDayKey(nextExam));
    parts.push(`Als Nächstes steht ${nextExam.kind === 'klausur' ? 'die Klausur' : 'der Test'} ${nextExam.subject ?? ''} ${relativeDays(d)} an.`.replace(/\s+/g, ' '));
  }
  if (r.holidays.current) parts.push(`Genieß die ${r.holidays.current.name} – noch ${r.holidays.currentDaysLeft} Tage.`);
  else if (r.holidays.next) parts.push(`Bis zu den ${r.holidays.next.name} sind es noch ${r.holidays.daysUntilNext} Tage.`);

  // Three concrete next steps, most important first.
  const steps: string[] = [];
  const klausurSoon = r.exams.find((e) => e.kind === 'klausur' && daysBetween(now, eventDayKey(e)) <= 14);
  if (klausurSoon) {
    const d = daysBetween(now, eventDayKey(klausurSoon));
    steps.push(`Teile den Stoff für ${klausurSoon.subject ?? 'die Klausur'} auf die ${d} Tage bis ${formatShort(eventDayKey(klausurSoon))} auf und plane Lernblöcke im Kalender ein.`);
  }
  if (s.shouldImprove && s.recommendedBedtime && !r.learning.active) {
    steps.push(`Geh diese Woche gegen ${s.recommendedBedtime} ins Bett und leg das Handy 30 Minuten vorher weg.`);
  }
  if (r.training.plannedLast7 > r.training.doneLast7 && r.training.nextTraining) {
    steps.push(`Zieh dein nächstes Training durch: ${r.training.nextTraining.title} am ${formatShort(eventDayKey(r.training.nextTraining))} – die Übungen stehen im Tab „Training“.`);
  }
  if (r.activity.hasData && r.activity.avgSteps < r.activity.goal * 0.8) {
    steps.push(`Bau täglich einen 20-Minuten-Spaziergang ein, um näher an ${r.activity.goal.toLocaleString('de-DE')} Schritte zu kommen.`);
  }
  if (r.oral.hasData && r.oral.score < 80) steps.push(r.oral.tips[0]);
  if (r.body.latestBp && r.body.bpCategory?.startsWith('erhöht')) {
    steps.push('Miss deinen Blutdruck ein paar Tage in Ruhe nach – bleibt er erhöht, sprich mit deinem Arzt.');
  }
  if (steps.length < 3 && r.training.nextTraining) {
    steps.push(`Nächstes Training: ${r.training.nextTraining.title} am ${formatShort(eventDayKey(r.training.nextTraining))}.`);
  }
  if (steps.length === 0) steps.push('Halte deine Routine – es läuft gut!');

  return { text: parts.join(' '), steps: [...new Set(steps)].slice(0, 3) };
}
