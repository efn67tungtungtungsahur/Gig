import { useMemo, useState } from 'react';
import { analyzeBodyMuscles, ENERGY_LABELS, RANK_NAMES, type MuscleStatus } from '../../domain/body';
import { MUSCLE_LABEL } from '../../domain/exercises';
import type { MuscleGroup } from '../../domain/types';
import { formatKg } from '../../domain/workoutLog';
import { daysBetween, formatShort, relativeDays } from '../../lib/dates';
import { useStore } from '../../lib/store';
import { BodyFigure, levelColor, RankBadge, rankBackground, rankFill } from '../bodyFigure';
import { Card, Segmented } from '../components';
import { useNav } from '../nav';

type Mode = 'last' | 'woche' | 'rang';

const WEEK_LABEL = ['0', '1–3', '4–7', '8–11', '12–15', '16+'];

const MODE_TEXT: Record<Mode, string> = {
  last: 'Wie viel Energie jeder Muskel gerade hat: tiefgelb = voll erholt, den kannst du richtig beanspruchen; blassgelb = Energie raus, lieber Pause. Jeder harte Satz zählt, Nebenmuskeln halb; nach etwa einem Tag ist die Hälfte wieder da.',
  woche: 'Sätze pro Muskel in den letzten 7 Tagen (Nebenmuskeln zählen halb). Für Muskelaufbau sind 10–20 Sätze pro Woche ideal.',
  rang: 'Rang pro Muskel aus deiner stärksten Übung der letzten 90 Tage im Verhältnis zum Körpergewicht – von Holz III bis Olympionike I.',
};

export function weeklyStatus(sets: number): string {
  if (sets <= 0) return 'keine Sätze';
  if (sets < 6) return 'zu wenig';
  if (sets < 10) return 'okay';
  if (sets <= 20) return 'optimal';
  return 'sehr viel';
}

function lastTrainedText(m: MuscleStatus): string {
  if (!m.lastTrained) return 'noch nicht trainiert';
  return `zuletzt ${relativeDays(-daysBetween(new Date(m.lastTrained), new Date()))}`;
}

function loadText(m: MuscleStatus): string {
  if (m.energyLevel === 5) return 'voll belastbar';
  return `Energie ${m.energy} % – ${ENERGY_LABELS[m.energyLevel]}${m.recoveredInH > 0 ? ` · belastbar in ~${m.recoveredInH} h` : ''}`;
}

function bestText(m: MuscleStatus): string {
  if (!m.best) return '';
  const b = m.best;
  return `${b.exercise.name}: ${b.weight > 0 ? `${formatKg(b.weight)} × ` : ''}${b.reps}${b.weight > 0 ? '' : ' Wdh.'}${b.secondary ? ' (Nebenmuskel)' : ''}`;
}

function nextText(m: MuscleStatus): string | undefined {
  const n = m.next;
  if (!n) return m.rank ? 'Höchster Rang erreicht 🏆' : undefined;
  return n.weight !== undefined ? `${n.exercise.name} ${formatKg(n.weight)} × ${n.reps}` : `${n.exercise.name} ${n.reps} Wdh.`;
}

export default function BodyScreen() {
  const { data, settings, updateSettings } = useStore();
  const { go } = useNav();
  const [mode, setMode] = useState<Mode>('last');
  const [selected, setSelected] = useState<MuscleGroup | null>(null);
  const [weightDraft, setWeightDraft] = useState<string | null>(null);
  const body = useMemo(() => analyzeBodyMuscles(data, settings), [data, settings]);
  const sel = body.muscles.find((m) => m.muscle === selected);

  const fill = (m: MuscleStatus) =>
    mode === 'rang' ? (m.rank ? rankFill(m.rank.tier) : undefined) : mode === 'last' ? `var(--energy-${m.energyLevel})` : levelColor(m.weeklyLevel);
  const fills = Object.fromEntries(body.muscles.map((m) => [m.muscle, fill(m)]));
  const hot = mode === 'last' ? body.muscles.filter((m) => m.energyLevel === 1).map((m) => m.muscle) : [];
  const legend: { label: string; color: string }[] =
    mode === 'last'
      ? ENERGY_LABELS.slice(1).map((label, i) => ({ label, color: `var(--energy-${i + 1})` }))
      : (mode === 'woche' ? WEEK_LABEL.map((l, i) => (i ? `${l} Sätze` : '0 Sätze')) : ['kein Rang', ...RANK_NAMES]).map((label, i) => ({
          label,
          color: i === 0 ? 'var(--fig-muscle)' : mode === 'rang' ? rankBackground(i - 1) : `var(--lvl-${i})`,
        }));

  const readout = (m: MuscleStatus) => {
    const name = MUSCLE_LABEL[m.muscle];
    if (mode === 'last') return `${name}: ${loadText(m)}`;
    if (mode === 'woche') return `${name}: ${m.weeklySets.toLocaleString('de-DE')} Sätze in 7 Tagen – ${weeklyStatus(m.weeklySets)}`;
    return m.rank ? `${name}: ${m.rank.name} – ${bestText(m)}` : `${name}: noch kein Rang`;
  };

  const select = (m: MuscleGroup) => setSelected((cur) => (cur === m ? null : m));

  const setWeight = (v: string) => {
    const n = Number(v.replace(',', '.'));
    void updateSettings((s) => ({ ...s, training: { ...s.training, bodyWeightKg: v.trim() && n >= 30 && n <= 250 ? Math.round(n * 10) / 10 : null } }));
  };

  return (
    <>
      <Card className="body-hero">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'last', label: 'Beanspruchung' },
            { value: 'woche', label: 'Woche' },
            { value: 'rang', label: 'Ränge' },
          ]}
        />
        <div className="readout" aria-live="polite" style={{ marginTop: 10, minHeight: 20 }}>
          {sel ? <strong>{readout(sel)}</strong> : <span className="muted">Tippe auf einen Muskel</span>}
        </div>
        <BodyFigure fills={fills} selected={selected} onSelect={select} hot={hot} />
        <div className="lvl-legend" aria-label="Legende">
          {legend.map((l) => (
            <span key={l.label}>
              <i style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          {MODE_TEXT[mode]}
        </p>
      </Card>

      {sel && <MuscleDetail m={sel} onClose={() => setSelected(null)} />}

      <Card title="Gesamt-Rang" icon="🏅">
        {body.overall ? (
          <>
            <div className="row" style={{ alignItems: 'center' }}>
              <span style={{ fontSize: 22 }}>
                <RankBadge tier={body.overall.tier} level={body.overall.level} name={body.overall.name} size={30} />
              </span>
              <span className="grow" />
              <span className="small muted">{body.trainedCount}/10 Muskeln</span>
            </div>
            <div className="meter" style={{ marginTop: 10 }} aria-label={`${Math.round(body.overall.progress * 100)} % bis zum nächsten Rang`}>
              <div style={{ width: `${Math.round(body.overall.progress * 100)}%`, background: rankBackground(body.overall.tier) }} />
            </div>
            <p className="tiny muted">Durchschnitt aller 10 Muskelgruppen – untrainierte zählen mit null. Wer alles trainiert, steigt schneller auf.</p>
          </>
        ) : (
          <p className="small muted" style={{ marginTop: 0 }}>
            Noch keine Ränge: Erfasse ein Training mit Gewichten (Tab Training → „Training starten“) oder importiere Liftoff-Workouts.
          </p>
        )}
        <div className="field" style={{ marginBottom: 8 }}>
          <span>Maßstab für die Kraftwerte</span>
          <Segmented
            value={settings.training.rankStandard}
            onChange={(v) => void updateSettings((s) => ({ ...s, training: { ...s.training, rankStandard: v } }))}
            options={[
              { value: 'm', label: 'Männer' },
              { value: 'w', label: 'Frauen' },
            ]}
          />
        </div>
        {body.bodyWeightSource === 'withings' ? (
          <p className="tiny muted" style={{ marginBottom: 0 }}>
            Körpergewicht {formatKg(body.bodyWeight)} von Withings.
          </p>
        ) : (
          <label className="field" style={{ marginBottom: 0 }}>
            <span>Dein Körpergewicht (kg){body.bodyWeightSource === 'schaetzung' ? ` – bis dahin wird mit ${body.bodyWeight} kg gerechnet` : ''}</span>
            <input
              className="input"
              inputMode="decimal"
              placeholder="z. B. 70"
              value={weightDraft ?? (settings.training.bodyWeightKg ? String(settings.training.bodyWeightKg).replace('.', ',') : '')}
              onChange={(e) => setWeightDraft(e.target.value)}
              onBlur={() => {
                if (weightDraft !== null) setWeight(weightDraft);
                setWeightDraft(null);
              }}
            />
          </label>
        )}
      </Card>

      {body.insights.length > 0 && (
        <Card title="Hinweise" icon="💡">
          <ul className="list">
            {body.insights.map((t) => (
              <li key={t} className="small">
                {t}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Muskel-Ränge" icon="💪">
        <ul className="list">
          {body.muscles.map((m) => (
            <li key={m.muscle}>
              <button
                className="muscle-row"
                onClick={() => {
                  setSelected(m.muscle);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <div className="row between">
                  <span className="strong">{MUSCLE_LABEL[m.muscle]}</span>
                  {m.rank ? <RankBadge tier={m.rank.tier} level={m.rank.level} name={m.rank.name} size={16} /> : <span className="small muted">kein Rang</span>}
                </div>
                {m.rank && (
                  <div className="meter" style={{ margin: '6px 0 4px' }}>
                    <div style={{ width: `${Math.round(m.rank.progress * 100)}%`, background: rankBackground(m.rank.tier) }} />
                  </div>
                )}
                <div className="tiny muted">
                  {m.best ? `${bestText(m)} · ` : ''}
                  {m.weeklySets.toLocaleString('de-DE')} Sätze/Woche · {loadText(m)}
                </div>
              </button>
            </li>
          ))}
        </ul>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          Ränge sind Richtwerte nach gängigen Kraft-Standards (1RM geschätzt nach Epley, Kurzhanteln pro Hand). Körpergewichtsübungen zählen über die
          Wiederholungen.{' '}
          <button className="btn ghost" style={{ padding: 0, minHeight: 0, fontSize: 'inherit' }} onClick={() => go('training')}>
            Zum Training
          </button>
        </p>
      </Card>
    </>
  );
}

function MuscleDetail({ m, onClose }: { m: MuscleStatus; onClose: () => void }) {
  const next = nextText(m);
  return (
    <Card
      title={MUSCLE_LABEL[m.muscle]}
      action={
        <button className="btn ghost" onClick={onClose}>
          Schließen
        </button>
      }
    >
      {m.rank ? (
        <>
          <div className="row between">
            <RankBadge tier={m.rank.tier} level={m.rank.level} name={m.rank.name} size={24} />
            <span className="small muted">{m.next ? `${Math.round(m.rank.progress * 100)} % zu ${m.next.name}` : 'höchster Rang'}</span>
          </div>
          <div className="meter" style={{ margin: '8px 0' }}>
            <div style={{ width: `${Math.round(m.rank.progress * 100)}%`, background: rankBackground(m.rank.tier) }} />
          </div>
          <div className="small">
            <strong>Beste Leistung:</strong> {bestText(m)}
            {m.best && <span className="muted"> · {formatShort(new Date(m.best.date))}</span>}
          </div>
          {next && (
            <div className="small" style={{ marginTop: 4 }}>
              <strong>{m.next ? `Für ${m.next.name}:` : ''}</strong> {next}
            </div>
          )}
        </>
      ) : (
        <p className="small muted" style={{ marginTop: 0 }}>
          Noch kein Rang – trainiere {MUSCLE_LABEL[m.muscle]} mit Gewicht oder einer Körpergewichtsübung wie Klimmzügen, Liegestützen oder Crunches.
        </p>
      )}
      <div className="stats" style={{ marginTop: 12 }}>
        <div className="stat">
          <div className="label">Energie</div>
          <div className="value" style={{ fontSize: 18 }}>
            {m.energy} %
          </div>
          <div className="delta">
            {ENERGY_LABELS[m.energyLevel]} · {m.recoveredInH > 0 ? `belastbar in ~${m.recoveredInH} h` : lastTrainedText(m)}
          </div>
        </div>
        <div className="stat">
          <div className="label">Sätze (7 Tage)</div>
          <div className="value" style={{ fontSize: 18 }}>
            {m.weeklySets.toLocaleString('de-DE')}
          </div>
          <div className="delta">{weeklyStatus(m.weeklySets)} · Ziel 10–20</div>
        </div>
      </div>
    </Card>
  );
}
