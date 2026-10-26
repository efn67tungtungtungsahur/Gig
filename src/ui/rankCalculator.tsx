import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { bodyWeightFor, levelFloor, RANKABLE, rankResult, standardKind, type BodyAnalysis } from '../domain/body';
import type { Exercise } from '../domain/exercises';
import { MUSCLE_LABEL } from '../domain/exercises';
import { formatKg, lastPerformance, newId } from '../domain/workoutLog';
import { formatShort } from '../lib/dates';
import { useStore } from '../lib/store';
import { BodyFigure, rankBackground, RankEmblem } from './bodyFigure';
import { Card, Sheet, toast } from './components';

/** Popular lifts first, the rest of the rankable catalogue after. */
const FEATURED = [
  'bankdruecken', 'kniebeuge', 'kreuzheben', 'klimmzuege', 'liegestuetze', 'dips', 'military_press', 'latzug',
  'kh_bankdruecken', 'lh_rudern', 'kh_curls', 'beinpresse', 'hip_thrust', 'schulterdruecken_kh', 'trizeps_kabel',
  'beinbeuger', 'wadenmaschine', 'crunches',
];
const ORDER: Exercise[] = [
  ...FEATURED.map((id) => RANKABLE.find((e) => e.id === id)).filter((e): e is Exercise => !!e),
  ...RANKABLE.filter((e) => !FEATURED.includes(e.id)),
];

const short = (name: string) => name.replace(/ \(.*\)/, '');
const fmt = (v: number) => String(v).replace('.', ',');

/** Horizontal scale you swipe; the value under the centre line counts. */
function Ruler({
  min,
  max,
  step,
  value,
  onChange,
  tick = 10,
  majorEvery = 5,
  labelEvery = 10,
  label,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  tick?: number;
  majorEvery?: number;
  labelEvery?: number;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pad, setPad] = useState(0);
  const count = Math.round((max - min) / step);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setPad(el.clientWidth / 2 - tick / 2);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tick]);

  // Follow value changes from outside (buttons, exercise switch).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = Math.round((value - min) / step) * tick;
    if (Math.abs(el.scrollLeft - target) > tick / 2) el.scrollLeft = target;
  }, [value, min, step, tick, pad]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.min(count, Math.max(0, Math.round(el.scrollLeft / tick)));
    const v = Math.round((min + i * step) * 100) / 100;
    if (v !== value) onChange(v);
  };

  return (
    <div className="ruler">
      <div className="ruler-needle" aria-hidden />
      <div
        className="ruler-track"
        ref={ref}
        onScroll={onScroll}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') onChange(Math.min(max, value + step));
          if (e.key === 'ArrowLeft') onChange(Math.max(min, value - step));
        }}
      >
        <div style={{ flex: `0 0 ${pad}px` }} />
        {Array.from({ length: count + 1 }, (_, i) => {
          const major = i % majorEvery === 0;
          const labelled = i % labelEvery === 0;
          return (
            <div key={i} className={`ruler-tick${major ? ' major' : ''}`} style={{ flex: `0 0 ${tick}px` }}>
              <i />
              {labelled && <span>{fmt(Math.round((min + i * step) * 100) / 100)}</span>}
            </div>
          );
        })}
        <div style={{ flex: `0 0 ${pad}px` }} />
      </div>
    </div>
  );
}

function Stepper({ value, unit, onChange, step, min, max, label }: { value: number; unit: string; onChange: (v: number) => void; step: number; min: number; max: number; label: string }) {
  return (
    <div className="calc-value">
      <span className="calc-label">{label}</span>
      <button className="icon-btn" aria-label={`${label} weniger`} onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))}>
        −
      </button>
      <span className="calc-number">
        {fmt(value)}
        <small>{unit}</small>
      </span>
      <button className="icon-btn" aria-label={`${label} mehr`} onClick={() => onChange(Math.min(max, Math.round((value + step) * 100) / 100))}>
        +
      </button>
    </div>
  );
}

export function RankCalculator({ body }: { body: BodyAnalysis }) {
  const { data, settings, updateData } = useStore();
  const [index, setIndex] = useState(0);
  const [weight, setWeight] = useState(20);
  const [reps, setReps] = useState(8);
  const [extra, setExtra] = useState(0);
  const [showExtra, setShowExtra] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const ex = ORDER[index];
  const kind = standardKind(ex) ?? 'ratio';
  const perHand = ex.needs[0] === 'dumbbells' || (Array.isArray(ex.needs[0]) && ex.needs[0][0] === 'dumbbells');
  const { kg: bodyWeight } = bodyWeightFor(data, settings);

  // Start each exercise with your last numbers.
  useEffect(() => {
    const last = lastPerformance(data.workoutLog, ex.id);
    const top = last?.reduce((a, b) => ((b.weight ?? 0) > (a.weight ?? 0) ? b : a), last[0]);
    if (kind === 'reps') {
      setReps(top?.reps ?? 10);
      setExtra(top?.weight ?? 0);
      setShowExtra(!!top?.weight);
    } else {
      setWeight(top?.weight ?? (perHand ? 10 : 20));
      setReps(top?.reps ?? 8);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex.id]);

  const used = kind === 'reps' ? (showExtra ? extra : 0) : weight;
  const result = useMemo(() => rankResult(ex, used, reps, bodyWeight, settings.training.rankStandard), [ex, used, reps, bodyWeight, settings.training.rankStandard]);
  const main = result?.muscles[0];
  const current = main ? body.muscles.find((m) => m.muscle === main.muscle) : undefined;
  const fills = Object.fromEntries(ex.muscles.map((m, i) => [m, i === 0 ? 'var(--accent)' : '#86b6ef']));
  const go = (d: number) => setIndex((i) => (i + d + ORDER.length) % ORDER.length);

  const save = () => {
    if (settings.demoMode) {
      toast('Im Demo-Modus wird nichts gespeichert – beende zuerst die Demo.');
      return;
    }
    void updateData((d) => ({ ...d, rankTests: [...d.rankTests, { id: newId('r'), date: new Date().toISOString(), exerciseId: ex.id, weight: used, reps }] }));
    toast(main ? `Gespeichert – zählt für deinen ${MUSCLE_LABEL[main.muscle].replace(/ \(.*\)/, '')}-Rang.` : 'Gespeichert.');
  };

  const history = [...data.rankTests].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);

  return (
    <>
      <Card className="body-hero">
        <div className="calc-carousel">
          <button className="icon-btn ghost" aria-label="Vorherige Übung" onClick={() => go(-1)}>
            ‹
          </button>
          <button className="calc-side" onClick={() => go(-1)}>
            {short(ORDER[(index - 1 + ORDER.length) % ORDER.length].name)}
          </button>
          <div className="calc-current">
            <div className="calc-name">{short(ex.name)}</div>
            <div className="body-hero mini" style={{ width: 120, margin: '6px auto 0', padding: 4 }}>
              <BodyFigure compact fills={fills} />
            </div>
          </div>
          <button className="calc-side" onClick={() => go(1)}>
            {short(ORDER[(index + 1) % ORDER.length].name)}
          </button>
          <button className="icon-btn ghost" aria-label="Nächste Übung" onClick={() => go(1)}>
            ›
          </button>
        </div>
        <button className="btn ghost block" style={{ marginTop: 6 }} onClick={() => setSearchOpen(true)}>
          🔍 Andere Übung suchen …
        </button>

        {kind === 'ratio' ? (
          <>
            <Stepper label={perHand ? 'Gewicht pro Hand' : 'Gewicht'} unit="kg" value={weight} onChange={setWeight} step={0.5} min={0} max={400} />
            <Ruler label="Gewicht" min={0} max={perHand ? 80 : 400} step={0.5} tick={8} majorEvery={10} labelEvery={perHand ? 10 : 40} value={weight} onChange={setWeight} />
          </>
        ) : showExtra ? (
          <>
            <Stepper label="Zusatzgewicht" unit="kg" value={extra} onChange={setExtra} step={0.5} min={0} max={150} />
            <Ruler label="Zusatzgewicht" min={0} max={150} step={0.5} tick={8} majorEvery={10} labelEvery={20} value={extra} onChange={setExtra} />
            <button className="btn ghost block" onClick={() => setShowExtra(false)}>
              Ohne Zusatzgewicht
            </button>
          </>
        ) : (
          <button className="btn block calc-outline" onClick={() => setShowExtra(true)}>
            + Zusatzgewicht hinzufügen
          </button>
        )}

        <Stepper label="Wdh." unit="wdh." value={reps} onChange={setReps} step={1} min={1} max={100} />
        <Ruler label="Wiederholungen" min={1} max={kind === 'reps' ? 100 : 30} step={1} tick={14} majorEvery={5} labelEvery={5} value={reps} onChange={setReps} />
      </Card>

      {result && main && (
        <Card>
          <div className="rank-hero">
            <RankEmblem tier={main.rank.tier} level={main.rank.level} muscle={main.muscle} size={64} />
            <div>
              <div className="name">{main.rank.name}</div>
              <div className="small muted">für {MUSCLE_LABEL[main.muscle]}</div>
            </div>
          </div>
          <div className="rank-bar" style={{ ['--bar' as string]: rankBackground(main.rank.tier) }}>
            <div style={{ width: `${Math.round(main.rank.progress * 100)}%` }} />
          </div>
          <p className="small secondary" style={{ margin: '4px 0 8px' }}>
            {result.kind === 'ratio'
              ? `≈ 1RM ${formatKg(Math.round(result.value * 2) / 2)} · das ${fmt(Math.round((result.value / bodyWeight) * 100) / 100)}-fache deines Körpergewichts (${formatKg(bodyWeight)})`
              : `≈ ${Math.round(result.value)} Wdh. mit reinem Körpergewicht (${formatKg(bodyWeight)})`}
            {levelFloor(main.rank.level + 1) === undefined ? ' · höchster Rang 🏆' : ''}
          </p>
          {result.muscles.length > 1 && (
            <div className="chips" style={{ marginBottom: 8 }}>
              {result.muscles.slice(1).map((m) => (
                <span key={m.muscle} className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <RankEmblem tier={m.rank.tier} muscle={m.muscle} size={18} pips={false} />
                  {MUSCLE_LABEL[m.muscle].replace(/ \(.*\)/, '')}: {m.rank.name}
                </span>
              ))}
            </div>
          )}
          {current && (
            <p className="small" style={{ marginTop: 0 }}>
              {current.rank
                ? main.rank.level > current.rank.level
                  ? `⬆️ Dein ${MUSCLE_LABEL[main.muscle].replace(/ \(.*\)/, '')}-Rang würde von ${current.rank.name} auf ${main.rank.name} steigen!`
                  : `Dein ${MUSCLE_LABEL[main.muscle].replace(/ \(.*\)/, '')}-Rang bleibt ${current.rank.name}.`
                : `Das wäre dein erster ${MUSCLE_LABEL[main.muscle].replace(/ \(.*\)/, '')}-Rang.`}
            </p>
          )}
          <button className="btn primary block" onClick={save}>
            Rang speichern
          </button>
          <p className="tiny muted" style={{ marginBottom: 0 }}>
            Gespeicherte Werte zählen für deine Muskel-Ränge (90 Tage), aber nicht für Beanspruchung und Wochensätze.
          </p>
        </Card>
      )}
      {!result && (
        <Card>
          <p className="small muted" style={{ margin: 0 }}>
            Trag {kind === 'ratio' ? 'ein Gewicht über 0 kg und ' : ''}mindestens eine Wiederholung ein.
          </p>
        </Card>
      )}

      {history.length > 0 && (
        <Card title="Rechnerverlauf" icon="🧮">
          <ul className="list">
            {history.map((t) => {
              const e = RANKABLE.find((x) => x.id === t.exerciseId);
              const r = e ? rankResult(e, t.weight, t.reps, bodyWeight, settings.training.rankStandard) : undefined;
              const m = r?.muscles[0];
              return (
                <li key={t.id} className="row small">
                  {m && <RankEmblem tier={m.rank.tier} level={m.rank.level} muscle={m.muscle} size={28} />}
                  <span className="grow">
                    <span className="strong">{e ? short(e.name) : t.exerciseId}</span>
                    <div className="tiny muted">
                      {t.weight > 0 ? `${formatKg(t.weight)} × ` : ''}
                      {t.reps} Wdh. · {formatShort(new Date(t.date))}
                      {m ? ` · ${m.rank.name}` : ''}
                    </div>
                  </span>
                  <button
                    className="btn ghost"
                    style={{ padding: '0 6px', minHeight: 32, color: 'var(--muted)' }}
                    aria-label="Eintrag löschen"
                    onClick={() => {
                      if (settings.demoMode) return;
                      void updateData((d) => ({ ...d, rankTests: d.rankTests.filter((x) => x.id !== t.id) }));
                    }}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {searchOpen && (
        <SearchSheet
          onClose={() => setSearchOpen(false)}
          onPick={(id) => {
            setIndex(ORDER.findIndex((e) => e.id === id));
            setSearchOpen(false);
          }}
        />
      )}
    </>
  );
}

function SearchSheet({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLocaleLowerCase('de-DE');
  const list = ORDER.filter(
    (e) => !query || e.name.toLocaleLowerCase('de-DE').includes(query) || e.muscles.some((m) => MUSCLE_LABEL[m].toLocaleLowerCase('de-DE').includes(query)),
  );
  return (
    <Sheet open onClose={onClose} title="Übung suchen">
      <input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="z. B. „Kniebeugen“ oder „Rücken“" />
      <ul className="list" style={{ marginTop: 10 }}>
        {list.map((e) => (
          <li key={e.id}>
            <button className="muscle-row" onClick={() => onPick(e.id)}>
              <span className="strong">{e.name}</span>
              <div className="tiny muted">
                {e.muscles.map((m) => MUSCLE_LABEL[m]).join(', ')} · {standardKind(e) === 'reps' ? 'Wiederholungen' : 'Gewicht × Wiederholungen'}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
