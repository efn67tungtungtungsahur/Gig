import { useState } from 'react';
import type { AiSummary } from '../../domain/types';
import { daysBetween, formatDate, formatMinutes, formatTime } from '../../lib/dates';
import { eventDayKey } from '../../domain/calendar';
import { useStore } from '../../lib/store';
import { aiOverallSummary } from '../../integrations/claude';
import { Card, Empty, ScoreRing, Status, scoreLevel, toast, useAction } from '../components';
import { useNav } from '../nav';

export default function ReportScreen() {
  const { report, settings, data, updateData } = useStore();
  const { go } = useNav();
  const { busy, run } = useAction();
  // Demo summaries live only in memory.
  const [demoSummary, setDemoSummary] = useState<AiSummary>();
  const r = report;

  /** Compact facts for the AI – no raw events, no personal identifiers. */
  const facts = () => ({
    datum: formatDate(new Date()),
    gesamtScore: r.overallScore,
    bereiche: r.areas.map((a) => ({ bereich: a.label, score: a.score ?? null, info: a.summary })),
    schlaf: {
      urteil: r.sleep.verdict,
      durchschnitt: formatMinutes(r.sleep.avgAsleepMin),
      zielStunden: settings.sleep.goalHours,
      empfohleneBettzeit: r.sleep.recommendedBedtime,
      tipps: r.sleep.tips,
    },
    learning: { active: r.learning.active, grund: r.learning.reason ?? null },
    aktivitaet: { schritteDurchschnitt: r.activity.avgSteps, ziel: r.activity.goal, ruhepuls: r.activity.avgRestingHr ?? null },
    koerper: {
      gewicht: r.body.latestWeight?.value ?? null,
      gewichtAenderung30Tage: r.body.weightChange30 ?? null,
      koerperfett: r.body.latestBodyFat?.value ?? null,
      blutdruck: r.body.latestBp ? `${r.body.latestBp.systolic}/${r.body.latestBp.diastolic} (${r.body.bpCategory})` : null,
    },
    training: {
      workouts7Tage: r.training.doneLast7,
      geplant7Tage: r.training.plannedLast7,
      liftoffRang: r.training.liftoff.latest?.rank ?? null,
      liftoffPlatz: r.training.liftoff.latest?.position ?? null,
      platzVeraenderung: r.training.liftoff.positionChange ?? null,
      neueErrungenschaften: r.training.liftoff.newAchievements,
      trainingsziel: settings.training.goal,
    },
    zahnpflege: r.oral.hasData ? { proTag: r.oral.sessionsPerDay, dauerSek: Math.round(r.oral.avgDurationSec), abdeckung: r.oral.avgCoverage ?? null } : null,
    schule: {
      pruefungen: r.exams.slice(0, 6).map((e) => ({ art: e.kind, fach: e.subject, inTagen: daysBetween(new Date(), eventDayKey(e)) })),
      ferien: r.holidays.current
        ? `gerade ${r.holidays.current.name}, noch ${r.holidays.currentDaysLeft} Tage`
        : r.holidays.next
          ? `${r.holidays.next.name} in ${r.holidays.daysUntilNext} Tagen`
          : null,
    },
  });

  const makeSummary = () =>
    run('ai', async () => {
      const text = await aiOverallSummary(settings.anthropicApiKey, facts());
      if (settings.demoMode) {
        toast('Demo: Die Zusammenfassung wird nicht gespeichert.');
        setDemoSummary({ text, createdAt: new Date().toISOString() });
        return;
      }
      await updateData((d) => ({ ...d, aiSummary: { text, createdAt: new Date().toISOString() } }));
    });

  const summary = settings.demoMode ? demoSummary : data.aiSummary;

  return (
    <>
      <Card>
        <div className="hero">
          <ScoreRing score={r.overallScore} size={92} />
          <div className="grow">
            <div className="muted small">Gesamt-Score</div>
            <Status level={scoreLevel(r.overallScore)}>
              {r.overallScore === undefined ? 'Noch keine Daten verbunden' : r.overallScore >= 80 ? 'Sehr gut' : r.overallScore >= 60 ? 'Gut, mit Luft nach oben' : 'Ausbaufähig'}
            </Status>
            <div className="tiny muted" style={{ marginTop: 4 }}>
              Stand {formatDate(new Date(r.generatedAt))}, {formatTime(new Date(r.generatedAt))} Uhr
            </div>
          </div>
        </div>
      </Card>

      <Card title="Alle Bereiche" icon="📋">
        <ul className="list">
          {r.areas.map((a) => (
            <li key={a.key} className="row">
              <ScoreRing score={a.score} size={44} />
              <span className="grow">
                <span className="strong">{a.label}</span>
                <div className="small secondary">{a.summary}</div>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {r.learning.active && (
        <div className="banner warn" style={{ marginBottom: 12 }}>
          <span aria-hidden>📚</span>
          <span className="small">{r.learning.reason} – Schlaf-Erinnerungen pausiert.</span>
        </div>
      )}

      <Card title="Das läuft gut" icon="✅">
        {r.strengths.length ? (
          <ul className="bullets small">
            {r.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ) : (
          <Empty>Sobald mehr Daten da sind, siehst du hier deine Stärken.</Empty>
        )}
      </Card>

      <Card title="Hier kannst du ansetzen" icon="🎯">
        {r.improvements.length ? (
          <ul className="bullets small">
            {r.improvements.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ) : (
          <Empty>Nichts Dringendes – stark!</Empty>
        )}
      </Card>

      <Card title="Die nächsten Tage" icon="🗓️">
        {r.nextDays.length ? (
          <ul className="bullets small">
            {r.nextDays.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ) : (
          <Empty>Keine besonderen Termine.</Empty>
        )}
      </Card>

      <Card title="KI-Coach" icon="✨">
        {summary ? (
          <>
            <p className="small pre" style={{ marginTop: 0 }}>
              {summary.text}
            </p>
            <p className="tiny muted">Erstellt am {formatDate(new Date(summary.createdAt))}</p>
          </>
        ) : (
          <p className="small secondary" style={{ marginTop: 0 }}>
            Lass Claude deine ausgewerteten Daten zu einer persönlichen Einschätzung mit drei konkreten nächsten Schritten zusammenfassen. Es werden nur
            die Kennzahlen oben gesendet, keine Kalendereinträge.
          </p>
        )}
        {settings.anthropicApiKey ? (
          <button className="btn primary block" onClick={makeSummary} disabled={busy !== null}>
            {busy === 'ai' ? 'Claude denkt nach …' : summary ? 'Neu erstellen' : 'KI-Zusammenfassung erstellen'}
          </button>
        ) : (
          <button className="btn block" onClick={() => go('einstellungen')}>
            Claude-API-Schlüssel eintragen
          </button>
        )}
      </Card>
    </>
  );
}
