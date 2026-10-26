import { useMemo } from 'react';
import { buildSummary } from '../../domain/summary';
import { formatDate, formatTime } from '../../lib/dates';
import { useStore } from '../../lib/store';
import { Card, Empty, ScoreRing, Status, scoreLevel } from '../components';

export default function ReportScreen() {
  const { report, settings } = useStore();
  const r = report;
  const summary = useMemo(() => buildSummary(report, settings), [report, settings]);

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

      <Card title="Zusammenfassung" icon="📝">
        <p className="small" style={{ marginTop: 0 }}>
          {summary.text}
        </p>
        <div className="section-title" style={{ marginTop: 12 }}>
          Deine nächsten 3 Schritte
        </div>
        <ol className="bullets small">
          {summary.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Card>
    </>
  );
}
