import { useEffect, useState } from 'react';
import type { LoggedExercise, LoggedSet, LoggedWorkout } from '../../domain/types';
import {
  addExercise,
  doneSets,
  exerciseKey,
  formatKg,
  formatVolume,
  lastPerformance,
  newRecords,
  suggestWeight,
  workoutSetCount,
  workoutVolume,
  type NewRecord,
} from '../../domain/workoutLog';
import { useStore } from '../../lib/store';
import { cancelRestEnd, scheduleRestEnd } from '../../integrations/notify';
import { Card, Empty, Sheet, toast } from '../components';
import { useNav } from '../nav';
import { AddExerciseSheet, ExerciseProgressSheet } from '../workoutSheets';

function clock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

function num(v: string): number | null {
  const n = Number(v.replace(',', '.'));
  return v.trim() && Number.isFinite(n) && n >= 0 ? n : null;
}

/** Lower end of "8–10" as the default reps. */
function defaultReps(target?: string): number | null {
  const m = target?.match(/\d+/);
  return m && !/min/.test(target ?? '') ? Number(m[0]) : null;
}

interface Rest {
  until: number;
  total: number;
  next: string;
}

/** Survives switching tabs while the workout is running. */
let lastRest: Rest | null = null;

/**
 * Number field that keeps what is typed ("27," on the way to "27,5") and
 * reports the parsed value.
 */
function NumInput({
  value,
  onChange,
  placeholder,
  label,
  decimal = false,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder: string;
  label: string;
  decimal?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? '' : String(value).replace('.', ','));
  return (
    <input
      className="input"
      style={{ minHeight: 38, padding: '6px 8px' }}
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={shown}
      placeholder={placeholder}
      onFocus={() => setDraft(shown)}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        const v = e.target.value.replace(decimal ? /[^\d.,]/g : /\D/g, '');
        setDraft(v);
        onChange(num(v));
      }}
      aria-label={label}
    />
  );
}

export default function WorkoutScreen() {
  const { data, updateData } = useStore();
  const { go } = useNav();
  const w = data.activeWorkout;
  const [now, setNow] = useState(Date.now());
  const [rest, setRestState] = useState<Rest | null>(() => (lastRest && lastRest.until > Date.now() - 60_000 ? lastRest : null));
  const setRest = (r: Rest | null) => {
    lastRest = r;
    setRestState(r);
  };
  const [addOpen, setAddOpen] = useState(false);
  const [progress, setProgress] = useState<{ key: string; name: string } | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!w) {
    return (
      <Card>
        <Empty
          action={
            <button className="btn primary block" onClick={() => go('training')}>
              Zum Training
            </button>
          }
        >
          Gerade läuft kein Training.
        </Empty>
      </Card>
    );
  }

  const log = data.workoutLog;
  const update = (fn: (w: LoggedWorkout) => LoggedWorkout) =>
    void updateData((d) => ({ ...d, activeWorkout: d.activeWorkout ? fn(d.activeWorkout) : null }));
  const updateExercise = (id: string, fn: (e: LoggedExercise) => LoggedExercise) =>
    update((cur) => ({ ...cur, exercises: cur.exercises.map((e) => (e.id === id ? fn(e) : e)) }));
  const updateSet = (exId: string, i: number, patch: Partial<LoggedSet>) =>
    updateExercise(exId, (e) => ({ ...e, sets: e.sets.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));

  const nextLabel = (ex: LoggedExercise, setIndex: number): string => {
    if (setIndex + 1 < ex.sets.length) return `${ex.name} – Satz ${setIndex + 2}`;
    const idx = w.exercises.findIndex((e) => e.id === ex.id);
    const following = w.exercises.slice(idx + 1).find((e) => e.sets.some((s) => !s.done));
    return following ? following.name : 'letzter Satz geschafft';
  };

  const toggleDone = (ex: LoggedExercise, i: number, placeholderWeight: number | null, placeholderReps: number | null) => {
    const s = ex.sets[i];
    if (s.done) {
      updateSet(ex.id, i, { done: false });
      return;
    }
    const weight = s.weight ?? placeholderWeight;
    const reps = s.reps ?? placeholderReps;
    if (!reps) {
      toast('Trag erst die Wiederholungen ein.');
      return;
    }
    updateSet(ex.id, i, { done: true, weight, reps });
    const secs = ex.restSec ?? 90;
    const next = nextLabel(ex, i);
    setRest({ until: Date.now() + secs * 1000, total: secs, next });
    void scheduleRestEnd(secs, next);
  };

  const shiftRest = (delta: number) => {
    if (!rest) return;
    const until = Math.max(Date.now(), rest.until + delta * 1000);
    setRest({ ...rest, until });
    void scheduleRestEnd(Math.round((until - Date.now()) / 1000), rest.next);
  };

  const skipRest = () => {
    setRest(null);
    void cancelRestEnd();
  };

  const elapsed = (now - new Date(w.start).getTime()) / 1000;
  const restLeft = rest ? (rest.until - now) / 1000 : 0;
  const records = newRecords({ ...w, end: new Date(now).toISOString() }, log);

  return (
    <>
      <Card>
        <div className="row">
          <div className="grow">
            <input
              className="input"
              style={{ fontWeight: 650, fontSize: 18, background: 'transparent', border: 0, padding: 0, minHeight: 0 }}
              value={w.title}
              onChange={(e) => update((cur) => ({ ...cur, title: e.target.value }))}
              aria-label="Name des Trainings"
            />
            <div className="small muted">
              ⏱ {clock(elapsed)} · {workoutSetCount(w)} Sätze · {formatVolume(workoutVolume(w))}
            </div>
          </div>
          <button className="btn primary" onClick={() => setFinishOpen(true)}>
            Beenden
          </button>
        </div>
      </Card>

      {w.exercises.map((ex) => {
        const key = exerciseKey(ex);
        const last = lastPerformance(log, key, w.start);
        const suggested = suggestWeight(last, ex.targetReps) ?? null;
        const placeholderReps = last?.[0]?.reps ?? defaultReps(ex.targetReps);
        return (
          <Card key={ex.id} className="tight">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <button
                className="grow"
                style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}
                onClick={() => setProgress({ key, name: ex.name })}
              >
                <div className="strong">{ex.name}</div>
                <div className="tiny muted">
                  {ex.targetSets ? `Ziel ${ex.targetSets} × ${ex.targetReps} · ` : ''}Pause {ex.restSec ?? 90} s
                </div>
                {last && (
                  <div className="tiny secondary">
                    Letztes Mal: {last.map((s) => `${formatKg(s.weight)} × ${s.reps}`).join(', ')}
                    {suggested && suggested > Math.max(...last.map((s) => s.weight ?? 0)) ? ` → heute ${formatKg(suggested)} versuchen` : ''}
                  </div>
                )}
              </button>
              <button
                className="btn ghost danger"
                style={{ padding: '0 4px', minHeight: 32 }}
                aria-label={`${ex.name} entfernen`}
                onClick={() => {
                  if (!doneSets(ex).length || window.confirm(`${ex.name} mit allen Sätzen entfernen?`)) {
                    update((cur) => ({ ...cur, exercises: cur.exercises.filter((e) => e.id !== ex.id) }));
                  }
                }}
              >
                ✕
              </button>
            </div>
            <table className="table" style={{ marginTop: 6 }}>
              <thead>
                <tr>
                  <th style={{ width: 34 }}>Satz</th>
                  <th>kg</th>
                  <th>Wdh.</th>
                  <th style={{ width: 44 }} />
                  <th style={{ width: 28 }} />
                </tr>
              </thead>
              <tbody>
                {ex.sets.map((s, i) => (
                  <tr key={i} style={s.done ? { background: 'color-mix(in srgb, var(--good) 14%, transparent)' } : undefined}>
                    <td className="strong">{i + 1}</td>
                    <td>
                      <NumInput
                        decimal
                        value={s.weight}
                        placeholder={suggested !== null ? String(suggested).replace('.', ',') : '0'}
                        onChange={(v) => updateSet(ex.id, i, { weight: v })}
                        label={`Gewicht Satz ${i + 1}`}
                      />
                    </td>
                    <td>
                      <NumInput
                        value={s.reps}
                        placeholder={placeholderReps !== null ? String(placeholderReps) : '–'}
                        onChange={(v) => updateSet(ex.id, i, { reps: v })}
                        label={`Wiederholungen Satz ${i + 1}`}
                      />
                    </td>
                    <td>
                      <button
                        className="btn"
                        style={{ minHeight: 38, padding: '0 10px', ...(s.done ? { background: 'var(--good)', color: '#fff' } : {}) }}
                        onClick={() => toggleDone(ex, i, suggested, placeholderReps)}
                        aria-label={s.done ? `Satz ${i + 1} nicht erledigt` : `Satz ${i + 1} erledigt`}
                      >
                        ✓
                      </button>
                    </td>
                    <td>
                      <button
                        className="btn ghost"
                        style={{ minHeight: 32, padding: '0 4px', color: 'var(--muted)' }}
                        aria-label={`Satz ${i + 1} löschen`}
                        onClick={() => updateExercise(ex.id, (e) => ({ ...e, sets: e.sets.filter((_, k) => k !== i) }))}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="btn ghost"
              style={{ paddingLeft: 0 }}
              onClick={() =>
                updateExercise(ex.id, (e) => {
                  const prev = e.sets[e.sets.length - 1];
                  return { ...e, sets: [...e.sets, { weight: prev?.weight ?? null, reps: prev?.reps ?? null, done: false }] };
                })
              }
            >
              + Satz
            </button>
          </Card>
        );
      })}

      <button className="btn block" style={{ marginBottom: 12 }} onClick={() => setAddOpen(true)}>
        + Übung hinzufügen
      </button>

      {rest && (
        <div
          className="card"
          style={{ position: 'sticky', bottom: 'calc(var(--safe-bottom) + 76px)', zIndex: 5, margin: 0, borderColor: restLeft <= 0 ? 'var(--good)' : undefined }}
        >
          <div className="row">
            <div className="grow">
              <div className="strong" style={{ fontSize: 22 }}>
                {restLeft > 0 ? `Pause ${clock(restLeft)}` : 'Pause vorbei 💪'}
              </div>
              <div className="tiny muted">Nächster: {rest.next}</div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--accent-soft)', marginTop: 6 }}>
                <div style={{ width: `${Math.max(0, Math.min(100, (1 - restLeft / rest.total) * 100))}%`, height: 4, borderRadius: 2, background: 'var(--accent)' }} />
              </div>
            </div>
            <button className="btn" style={{ padding: '0 10px' }} onClick={() => shiftRest(-15)}>
              −15
            </button>
            <button className="btn" style={{ padding: '0 10px' }} onClick={() => shiftRest(15)}>
              +15
            </button>
            <button className="btn ghost" onClick={skipRest}>
              {restLeft > 0 ? 'Weiter' : 'OK'}
            </button>
          </div>
        </div>
      )}

      {addOpen && (
        <AddExerciseSheet
          equipment={data.gym.equipment}
          onClose={() => setAddOpen(false)}
          onPick={(entry) => {
            update((cur) => addExercise(cur, entry, log));
            setAddOpen(false);
          }}
        />
      )}

      {progress && <ExerciseProgressSheet log={log} exerciseKey={progress.key} name={progress.name} onClose={() => setProgress(null)} />}

      {finishOpen && (
        <FinishSheet
          workout={w}
          records={records}
          onClose={() => setFinishOpen(false)}
          onDiscard={() => {
            if (!window.confirm('Training verwerfen? Die eingetragenen Sätze gehen verloren.')) return;
            lastRest = null;
            void cancelRestEnd();
            void updateData((d) => ({ ...d, activeWorkout: null }));
            go('training');
          }}
          onSave={(note) => {
            const finished: LoggedWorkout = {
              ...w,
              end: new Date().toISOString(),
              note: note || undefined,
              // Keep only exercises with at least one completed set; drop unfinished sets.
              exercises: w.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) })).filter((e) => e.sets.length),
            };
            lastRest = null;
            void cancelRestEnd();
            void updateData((d) => ({ ...d, activeWorkout: null, workoutLog: [...d.workoutLog, finished] }));
            toast(records.length ? `🏆 Gespeichert – ${records.length} neue${records.length === 1 ? 'r' : ''} Rekord${records.length === 1 ? '' : 'e'}!` : '💪 Training gespeichert.');
            go('training');
          }}
        />
      )}
    </>
  );
}

function FinishSheet({
  workout,
  records,
  onClose,
  onSave,
  onDiscard,
}: {
  workout: LoggedWorkout;
  records: NewRecord[];
  onClose: () => void;
  onSave: (note: string) => void;
  onDiscard: () => void;
}) {
  const [note, setNote] = useState('');
  const sets = workoutSetCount(workout);
  const open = workout.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);
  return (
    <Sheet open onClose={onClose} title="Training beenden">
      <div className="stats" style={{ marginBottom: 12 }}>
        <div className="stat">
          <div className="label">Sätze</div>
          <div className="value">{sets}</div>
        </div>
        <div className="stat">
          <div className="label">Volumen</div>
          <div className="value">{formatVolume(workoutVolume(workout))}</div>
        </div>
      </div>
      {records.length > 0 && (
        <div className="banner info small" style={{ marginBottom: 10 }}>
          <span aria-hidden>🏆</span>
          <span>
            {records.map((r) => (
              <div key={r.name}>
                {r.name}: {r.kind === 'gewicht' ? `${formatKg(r.value)} (vorher ${formatKg(r.previous)})` : `neues 1RM ≈ ${formatKg(Math.round(r.value * 2) / 2)}`}
              </div>
            ))}
          </span>
        </div>
      )}
      {open > 0 && <p className="small muted">{open} nicht abgehakte Sätze werden nicht gespeichert.</p>}
      <label className="field">
        <span>Notiz (optional)</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Schulter gezwickt, guter Tag" />
      </label>
      <button className="btn primary block" disabled={sets === 0} onClick={() => onSave(note.trim())}>
        {sets ? 'Speichern' : 'Noch kein Satz abgehakt'}
      </button>
      <button className="btn block danger" style={{ marginTop: 8 }} onClick={onDiscard}>
        Training verwerfen
      </button>
    </Sheet>
  );
}
