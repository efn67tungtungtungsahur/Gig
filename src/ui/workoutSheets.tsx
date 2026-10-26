import { useMemo, useState } from 'react';
import { availableExercises, EXERCISES, MUSCLE_LABEL } from '../domain/exercises';
import type { LoggedWorkout } from '../domain/types';
import {
  doneSets,
  estimated1RM,
  exerciseHistory,
  exerciseKey,
  formatKg,
  formatVolume,
  personalRecords,
  workoutDurationMin,
  workoutSetCount,
  workoutVolume,
} from '../domain/workoutLog';
import { formatShort, formatTime } from '../lib/dates';
import { LineChart } from './charts';
import { Empty, Sheet, Stat } from './components';

/** Pick an exercise from the catalogue (your equipment first) or type your own. */
export function AddExerciseSheet({
  equipment,
  onClose,
  onPick,
}: {
  equipment: string[];
  onClose: () => void;
  onPick: (e: { exerciseId?: string; name: string }) => void;
}) {
  const [q, setQ] = useState('');
  const mine = useMemo(() => new Set(availableExercises(equipment).map((e) => e.id)), [equipment]);
  const query = q.trim().toLocaleLowerCase('de-DE');
  const list = EXERCISES.filter((e) => !query || e.name.toLocaleLowerCase('de-DE').includes(query) || e.muscles.some((m) => MUSCLE_LABEL[m].toLowerCase().includes(query)))
    .sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)) || a.name.localeCompare(b.name))
    .slice(0, 40);
  return (
    <Sheet open onClose={onClose} title="Übung hinzufügen">
      <input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen, z. B. „Bank“ oder „Rücken“" />
      {query && !EXERCISES.some((e) => e.name.toLocaleLowerCase('de-DE') === query) && (
        <button className="btn block" style={{ marginTop: 10 }} onClick={() => onPick({ name: q })}>
          + „{q.trim()}“ als eigene Übung
        </button>
      )}
      <ul className="list" style={{ marginTop: 10 }}>
        {list.map((e) => (
          <li key={e.id}>
            <button className="row" style={{ width: '100%', background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => onPick({ exerciseId: e.id, name: e.name })}>
              <span className="grow">
                <span className="strong">{e.name}</span>
                <div className="tiny muted">{e.muscles.map((m) => MUSCLE_LABEL[m]).join(', ')}</div>
              </span>
              {!mine.has(e.id) && <span className="pill">Gerät fehlt</span>}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** History, records and a weight chart for one exercise. */
export function ExerciseProgressSheet({ log, exerciseKey, name, onClose }: { log: LoggedWorkout[]; exerciseKey: string; name: string; onClose: () => void }) {
  const history = exerciseHistory(log, exerciseKey);
  const rec = personalRecords(log).get(exerciseKey);
  return (
    <Sheet open onClose={onClose} title={name}>
      {history.length === 0 ? (
        <Empty>Noch keine abgeschlossenen Sätze für diese Übung.</Empty>
      ) : (
        <>
          <div className="stats" style={{ marginBottom: 12 }}>
            <Stat label="Bestes Gewicht" value={formatKg(rec?.maxWeight)} />
            <Stat label="Geschätztes 1RM" value={formatKg(rec ? Math.round(rec.best1RM * 2) / 2 : undefined)} />
            <Stat label="Einheiten" value={history.length} />
          </div>
          {history.length > 1 && (
            <LineChart
              ariaLabel={`Höchstes Gewicht ${name}`}
              unit=" kg"
              points={history.map((h) => ({
                key: h.date,
                label: formatShort(new Date(h.date)),
                value: h.topWeight,
                readout: `${formatShort(new Date(h.date))}: ${h.sets.map((s) => `${formatKg(s.weight)} × ${s.reps}`).join(', ')}`,
              }))}
            />
          )}
          <ul className="list" style={{ marginTop: 10 }}>
            {[...history].reverse().slice(0, 10).map((h) => (
              <li key={h.date} className="small">
                <div className="row between">
                  <span className="strong">{formatShort(new Date(h.date))}</span>
                  <span className="muted">{formatVolume(h.volume)}</span>
                </div>
                <div className="secondary">{h.sets.map((s) => `${formatKg(s.weight)} × ${s.reps}`).join(' · ')}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}

/** A finished workout with all sets. */
export function WorkoutDetailSheet({
  workout,
  onClose,
  onDelete,
  onExercise,
}: {
  workout: LoggedWorkout;
  onClose: () => void;
  onDelete: () => void;
  onExercise: (key: string, name: string) => void;
}) {
  return (
    <Sheet open onClose={onClose} title={workout.title}>
      <div className="stats" style={{ marginBottom: 12 }}>
        <Stat label="Dauer" value={`${workoutDurationMin(workout)} min`} delta={`${formatShort(new Date(workout.start))}, ${formatTime(new Date(workout.start))} Uhr`} />
        <Stat label="Sätze" value={workoutSetCount(workout)} />
        <Stat label="Volumen" value={formatVolume(workoutVolume(workout))} />
      </div>
      <ul className="list">
        {workout.exercises
          .filter((e) => doneSets(e).length)
          .map((e) => (
            <li key={e.id}>
              <button
                style={{ width: '100%', background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit' }}
                onClick={() => onExercise(exerciseKey(e), e.name)}
              >
                <div className="strong">{e.name}</div>
                <div className="small secondary">
                  {doneSets(e)
                    .map((s) => `${formatKg(s.weight)} × ${s.reps}`)
                    .join(' · ')}
                </div>
                <div className="tiny muted">
                  Bester Satz ≈ 1RM {formatKg(Math.round(Math.max(...doneSets(e).map((s) => estimated1RM(s.weight ?? 0, s.reps ?? 0))) * 2) / 2)}
                </div>
              </button>
            </li>
          ))}
      </ul>
      {workout.note && <p className="small secondary">📝 {workout.note}</p>}
      <button
        className="btn block danger"
        style={{ marginTop: 12 }}
        onClick={() => {
          if (window.confirm('Dieses Training löschen?')) onDelete();
        }}
      >
        Training löschen
      </button>
    </Sheet>
  );
}
