import { useMemo, useState } from 'react';
import { eventDayKey, upcoming } from '../../domain/calendar';
import { EQUIPMENT, EQUIPMENT_GROUPS, EQUIPMENT_PRESETS, MUSCLE_LABEL } from '../../domain/exercises';
import { latestSnapshot } from '../../domain/liftoff';
import { planTraining } from '../../domain/planner';
import { signed } from '../../domain/report';
import type { LiftoffSnapshot, MuscleGroup } from '../../domain/types';
import { formatVolume, personalRecords, workoutDurationMin, workoutFromPlan, workoutSetCount, workoutVolume } from '../../domain/workoutLog';
import { addDays, dayKey, formatDate, formatShort, formatTime } from '../../lib/dates';
import { useStore } from '../../lib/store';
import { parseLiftoffText, type LiftoffDraft } from '../../domain/ocrParse';
import { readScreenshots } from '../../integrations/ocr';
import { Card, Empty, Sheet, Stat, toast, useAction } from '../components';
import { analyzeBodyMuscles } from '../../domain/body';
import { BodyFigure, RankBadge, rankFill } from '../bodyFigure';
import { useNav } from '../nav';
import { ExerciseProgressSheet, WorkoutDetailSheet } from '../workoutSheets';

const FREE_FOCUS: { label: string; groups: MuscleGroup[] }[] = [
  { label: 'Ganzkörper', groups: ['beine', 'brust', 'ruecken', 'schultern', 'core'] },
  { label: 'Push', groups: ['brust', 'schultern', 'trizeps'] },
  { label: 'Pull', groups: ['ruecken', 'bizeps'] },
  { label: 'Beine', groups: ['beine', 'po', 'beinbeuger', 'waden'] },
  { label: 'Oberkörper', groups: ['brust', 'ruecken', 'schultern', 'bizeps', 'trizeps'] },
  { label: 'Cardio', groups: ['cardio'] },
];

export default function TrainingScreen() {
  const { report, data, settings, updateData } = useStore();
  const { go } = useNav();
  const { busy, run } = useAction();
  const [editOpen, setEditOpen] = useState(false);
  const [liftoffDraft, setLiftoffDraft] = useState<{ draft?: LiftoffDraft; version: number } | null>(null);
  const trainings = upcoming(report.events, new Date(), ['training'], 14);
  const [selected, setSelected] = useState<string | 'frei'>(trainings[0]?.id ?? 'frei');
  const [freeFocus, setFreeFocus] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ key: string; name: string } | null>(null);
  const [showAll, setShowAll] = useState(false);

  const equipment = data.gym.equipment;
  const event = trainings.find((t) => t.id === selected);
  const plan = useMemo(() => {
    const now = new Date();
    const base = event ?? {
      title: `Freies Training: ${FREE_FOCUS[freeFocus].label}`,
      start: now.toISOString(),
      end: new Date(now.getTime() + 60 * 60_000).toISOString(),
      focus: FREE_FOCUS[freeFocus].groups,
    };
    return planTraining(base, equipment, settings.training.goal, report.training.workouts);
  }, [event, freeFocus, equipment, settings.training.goal, report.training.workouts]);

  const guardDemo = () => {
    if (settings.demoMode) {
      toast('Im Demo-Modus wird nichts gespeichert – beende zuerst die Demo.');
      return true;
    }
    return false;
  };

  const setEquipment = (fn: (current: string[]) => string[]) => {
    if (guardDemo()) return;
    void updateData((d) => ({ ...d, gym: { ...d.gym, equipment: fn(d.gym.equipment), scannedAt: new Date().toISOString() } }));
  };
  const toggleEquipment = (id: string) => setEquipment((cur) => (cur.includes(id) ? cur.filter((e) => e !== id) : [...cur, id]));

  const importLiftoff = () =>
    run('liftoff', async () => {
      if (guardDemo()) return;
      const rows = await readScreenshots(6);
      if (!rows) return;
      const draft = parseLiftoffText(rows, settings.liftoff.email.split('@')[0] || undefined);
      setLiftoffDraft({ draft, version: Date.now() });
    });

  const saveSnapshot = async (snap: LiftoffSnapshot) => {
    await updateData((d) => {
      // Screenshots of different screens on the same day are merged into one snapshot.
      const today = snap.date.slice(0, 10);
      const existing = d.liftoff.snapshots.find((s) => s.date.slice(0, 10) === today);
      // Achievements accumulate: keep earlier ones, newer status wins per name.
      const byName = new Map((existing ?? latestSnapshot(d.liftoff))?.achievements.map((a) => [a.name, a]) ?? []);
      snap.achievements.forEach((a) => byName.set(a.name, a));
      const merged: LiftoffSnapshot = {
        ...existing,
        ...Object.fromEntries(Object.entries(snap).filter(([, v]) => v !== undefined)),
        achievements: [...byName.values()],
        leaderboard: snap.leaderboard.length ? snap.leaderboard : (existing?.leaderboard ?? []),
      } as LiftoffSnapshot;
      return { ...d, liftoff: { ...d.liftoff, snapshots: [...d.liftoff.snapshots.filter((s) => s !== existing), merged] } };
    });
  };

  const lift = latestSnapshot(data.liftoff);
  const ls = report.training.liftoff;
  const ts = report.trainingStreak;

  const body = useMemo(() => analyzeBodyMuscles(data, settings), [data, settings]);
  const tiredFocus = body.muscles.filter((m) => m.loadLevel >= 4 && plan.exercises.some((p) => p.exercise.muscles[0] === m.muscle));
  const active = data.activeWorkout;
  const logged = [...data.workoutLog].sort((a, b) => b.start.localeCompare(a.start));
  const weekAgo = addDays(new Date(), -7).toISOString();
  const lastWeek = logged.filter((w) => w.start >= weekAgo);
  const topExercises = [...personalRecords(data.workoutLog).values()].sort((a, b) => b.sessions - a.sessions).slice(0, 8);
  const detail = logged.find((w) => w.id === detailId);

  const startWorkout = (withPlan: boolean) => {
    if (guardDemo()) return;
    if (data.activeWorkout) {
      go('workout');
      return;
    }
    const now = new Date();
    // Link to the calendar training only when it is today.
    const eventId = event && eventDayKey(event) === dayKey(now) ? event.id : undefined;
    const title = event ? event.title : withPlan ? FREE_FOCUS[freeFocus].label : 'Training';
    const w = workoutFromPlan(withPlan ? plan : null, data.workoutLog, { title, eventId, now });
    void updateData((d) => ({ ...d, activeWorkout: w })).then(() => go('workout'));
  };

  const markTraining = (eventId: string, status: 'done' | 'missed' | 'skipped' | null) => {
    if (guardDemo()) return;
    void updateData((d) => {
      const log = { ...d.trainingLog };
      if (status) log[eventId] = status;
      else delete log[eventId];
      return { ...d, trainingLog: log };
    });
  };

  return (
    <>
      <Card title="Training erfassen" icon="📝">
        {active ? (
          <div className="row">
            <div className="grow">
              <div className="strong">{active.title}</div>
              <div className="small muted">
                Läuft seit {workoutDurationMin(active)} min · {workoutSetCount(active)} Sätze abgehakt
              </div>
            </div>
            <button className="btn primary" onClick={() => go('workout')}>
              Weiter
            </button>
          </div>
        ) : (
          <>
            <p className="small secondary" style={{ marginTop: 0 }}>
              Trag jede Übung mit Sätzen, Gewicht und Wiederholungen ein. Die App merkt sich das letzte Mal, schlägt dir das nächste Gewicht vor und
              zählt das Training automatisch für deine Serie.
            </p>
            <button className="btn primary block" onClick={() => startWorkout(true)}>
              ▶ {event ? event.title : FREE_FOCUS[freeFocus].label} starten ({plan.exercises.length} Übungen)
            </button>
            <button className="btn block" style={{ marginTop: 8 }} onClick={() => startWorkout(false)}>
              Leeres Training starten
            </button>
          </>
        )}
        {logged.length > 0 && (
          <div className="stats" style={{ marginTop: 12 }}>
            <Stat label="Letzte 7 Tage" value={lastWeek.length} delta={lastWeek.length === 1 ? 'Training' : 'Trainings'} />
            <Stat label="Volumen 7 T." value={formatVolume(lastWeek.reduce((s, w) => s + workoutVolume(w), 0))} />
            <Stat label="Sätze 7 T." value={lastWeek.reduce((s, w) => s + workoutSetCount(w), 0)} />
          </div>
        )}
      </Card>

      <Card>
        <div className="streak">
          <span className="flame" aria-hidden>
            {ts.current > 0 ? '🔥' : '🧊'}
          </span>
          <div className="grow">
            <div>
              <span className="count">{ts.current}</span> <span className="secondary">Trainings-Serie</span>
            </div>
            <div className="tiny muted">Geplante Trainings in Folge durchgezogen · Rekord {ts.best}</div>
          </div>
        </div>
        <p className="tiny muted">
          Die Serie richtet sich nach deinen Trainingsterminen im Kalender: Ruhetage zählen nicht, nur ein verpasstes Training beendet sie. Erledigt ist
          ein Training, wenn du es an dem Tag hier erfasst, ein Workout von Fitbit/Liftoff kommt oder du es abhakst. Abgesagte Termine zählen nicht.
          {ts.next ? ` Nächstes: ${ts.next.title} am ${formatShort(eventDayKey(ts.next))}` : ''}
        </p>
        {ts.sessions.length === 0 ? (
          <p className="small muted" style={{ marginBottom: 0 }}>
            Noch keine vergangenen Trainings im Kalender. Termine mit „Training“, „Gym“, „Push“, „Beine“ … zählen automatisch.
          </p>
        ) : (
          <ul className="list">
            {ts.sessions.slice(0, 6).map(({ event: e, status, auto }) => (
              <li key={e.id} className="row small">
                <span aria-hidden>{status === 'done' ? '✅' : status === 'missed' ? '❌' : status === 'skipped' ? '➖' : '⏳'}</span>
                <span className="grow">
                  {e.title}
                  <div className="tiny muted">
                    {formatShort(eventDayKey(e))}
                    {auto ? ' · Workout erfasst' : status === 'pending' ? ' · offen' : status === 'skipped' ? ' · abgesagt' : ''}
                  </div>
                </span>
                {!auto && (
                  <>
                    <button className={`chip ${data.trainingLog[e.id] === 'done' ? 'on' : ''}`} onClick={() => markTraining(e.id, data.trainingLog[e.id] === 'done' ? null : 'done')}>
                      Erledigt
                    </button>
                    <button className={`chip ${data.trainingLog[e.id] === 'skipped' ? 'on' : ''}`} onClick={() => markTraining(e.id, data.trainingLog[e.id] === 'skipped' ? null : 'skipped')}>
                      Abgesagt
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Körperübersicht"
        icon="🧍"
        action={
          <button className="btn ghost" onClick={() => go('koerper')}>
            Öffnen
          </button>
        }
      >
        <button className="muscle-row" onClick={() => go('koerper')} aria-label="Körperübersicht öffnen">
          <div className="row" style={{ alignItems: 'center', gap: 12 }}>
            <div className="body-hero mini" style={{ width: 150, flex: 'none' }}>
              <BodyFigure compact fills={Object.fromEntries(body.muscles.map((m) => [m.muscle, m.rank ? rankFill(m.rank.tier) : undefined]))} />
            </div>
            <div className="grow small">
              {body.overall ? (
                <div style={{ marginBottom: 6 }}>
                  <div className="tiny muted">Gesamt-Rang</div>
                  <RankBadge tier={body.overall.tier} level={body.overall.level} name={body.overall.name} />
                </div>
              ) : (
                <p className="muted" style={{ marginTop: 0 }}>Noch keine Ränge – erfasse dein erstes Training.</p>
              )}
              <div className="tiny muted">Energie</div>
              <div>
                {body.muscles
                  .filter((m) => m.energyLevel < 5)
                  .sort((a, b) => a.energy - b.energy)
                  .map((m) => `${MUSCLE_LABEL[m.muscle].replace(/ \(.*\)/, '')} ${m.energy} %`)
                  .join(', ') || 'alle Muskeln voll belastbar'}
              </div>
            </div>
          </div>
        </button>
      </Card>

      <Card
        title="Meine Geräte"
        icon="🏠"
        action={
          <button className="btn ghost" onClick={() => setEditOpen(true)}>
            {equipment.length ? 'Ändern' : 'Auswählen'}
          </button>
        }
      >
        {equipment.length === 0 ? (
          <Empty
            action={
              <button className="btn primary block" onClick={() => setEditOpen(true)}>
                Geräte auswählen
              </button>
            }
          >
            Gib an, welche Geräte du zum Trainieren hast. Daraus entstehen deine Übungsvorschläge. Ohne Auswahl gibt es nur Körpergewichtsübungen.
          </Empty>
        ) : (
          <>
            <div className="chips">
              {equipment.map((id) => (
                <span key={id} className="pill">
                  {EQUIPMENT[id] ?? id}
                </span>
              ))}
            </div>
            {data.gym.scannedAt && (
              <p className="tiny muted" style={{ marginBottom: 0 }}>
                Zuletzt geändert am {formatDate(new Date(data.gym.scannedAt))}
              </p>
            )}
          </>
        )}
      </Card>

      <Card title="Übungen für dein Training" icon="🏋️">
        <div className="chips" style={{ marginBottom: 12 }}>
          {trainings.map((t) => (
            <button key={t.id} className={`chip ${selected === t.id ? 'on' : ''}`} onClick={() => setSelected(t.id)}>
              {formatShort(eventDayKey(t))} · {t.title}
            </button>
          ))}
          <button className={`chip ${selected === 'frei' || !event ? 'on' : ''}`} onClick={() => setSelected('frei')}>
            Freies Training
          </button>
        </div>
        {!event && (
          <div className="chips" style={{ marginBottom: 12 }}>
            {FREE_FOCUS.map((f, i) => (
              <button key={f.label} className={`chip ${freeFocus === i ? 'on' : ''}`} onClick={() => setFreeFocus(i)}>
                {f.label}
              </button>
            ))}
          </div>
        )}
        {trainings.length === 0 && (
          <p className="tiny muted" style={{ marginTop: 0 }}>
            Keine Trainings in den nächsten 14 Tagen im Kalender. Termine mit „Training“, „Gym“, „Push“, „Beine“ … werden automatisch erkannt.
          </p>
        )}
        <div className="row between small" style={{ marginBottom: 6 }}>
          <span className="strong">{plan.focusLabel}</span>
          <span className="muted">
            {event ? `${formatTime(new Date(event.start))} Uhr · ` : ''}
            {plan.durationMin} min
          </span>
        </div>
        {tiredFocus.length > 0 && (
          <div className="banner warn small" style={{ marginBottom: 8 }}>
            <span aria-hidden>⚠️</span>
            <span>
              {tiredFocus.map((m) => MUSCLE_LABEL[m.muscle].replace(/ \(.*\)/, '')).join(', ')} {tiredFocus.length === 1 ? 'ist' : 'sind'} noch stark
              beansprucht. Heute leichter trainieren oder einen anderen Fokus wählen.
            </span>
          </div>
        )}
        <div className="banner small" style={{ marginBottom: 8 }}>
          <span aria-hidden>🔥</span>
          <span>
            <strong>Aufwärmen:</strong> {plan.warmup}
          </span>
        </div>
        <div>
          {plan.exercises.map((p, i) => (
            <div key={p.exercise.id} className="exercise">
              <div className="num">{i + 1}</div>
              <div>
                <div className="strong">{p.exercise.name}</div>
                <div className="tiny muted">
                  {p.exercise.muscles.map((m) => MUSCLE_LABEL[m]).join(', ')} · {p.exercise.cue}
                </div>
              </div>
              <div className="small" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <div className="strong">{p.sets > 1 ? `${p.sets} × ${p.reps}` : p.reps}</div>
                {p.restSec > 0 && <div className="tiny muted">{p.restSec} s Pause</div>}
              </div>
            </div>
          ))}
        </div>
        <div className="banner small" style={{ marginTop: 8 }}>
          <span aria-hidden>🧘</span>
          <span>
            <strong>Abschluss:</strong> {plan.cooldown}
          </span>
        </div>
        {plan.hints.map((h) => (
          <p key={h} className="tiny muted" style={{ marginBottom: 0 }}>
            💡 {h}
          </p>
        ))}
        {!active && plan.exercises.length > 0 && (
          <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => startWorkout(true)}>
            ▶ Mit diesen Übungen starten
          </button>
        )}
      </Card>

      <Card title="Verlauf & Fortschritt" icon="📈">
        {logged.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>
            Noch keine Trainings erfasst. Nach dem ersten Training siehst du hier jede Einheit mit allen Sätzen und deinen Fortschritt pro Übung.
          </p>
        ) : (
          <>
            <ul className="list">
              {(showAll ? logged : logged.slice(0, 5)).map((w) => (
                <li key={w.id}>
                  <button
                    style={{ width: '100%', background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit' }}
                    onClick={() => setDetailId(w.id)}
                  >
                    <div className="row between small">
                      <span className="strong">{w.title}</span>
                      <span className="muted">
                        {formatShort(new Date(w.start))} · {workoutDurationMin(w)} min
                      </span>
                    </div>
                    <div className="tiny muted">
                      {workoutSetCount(w)} Sätze · {formatVolume(workoutVolume(w))} · {w.exercises.map((e) => e.name).join(', ')}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {logged.length > 5 && (
              <button className="btn ghost" style={{ paddingLeft: 0 }} onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Weniger anzeigen' : `Alle ${logged.length} anzeigen`}
              </button>
            )}
            {topExercises.length > 0 && (
              <>
                <div className="section-title">Fortschritt pro Übung</div>
                <div className="chips">
                  {topExercises.map((r) => (
                    <button key={r.key} className="chip" onClick={() => setProgress({ key: r.key, name: r.name })}>
                      {r.name} · {r.maxWeight ? `${String(r.maxWeight).replace('.', ',')} kg` : `${r.sessions}×`}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </Card>

      <Card
        title="Liftoff"
        icon="🚀"
        action={
          <button className="btn ghost" onClick={() => setLiftoffDraft({ version: Date.now() })}>
            Eintragen
          </button>
        }
      >
        {!lift && !data.liftoff.workouts.length ? (
          <Empty
            action={
              <button className="btn primary block" onClick={importLiftoff} disabled={busy !== null}>
                {busy === 'liftoff' ? 'Lese Screenshots …' : 'Screenshots importieren'}
              </button>
            }
          >
            Mach Screenshots von Rangliste, Rang und Errungenschaften in der Liftoff-App und importiere sie hier – die Texterkennung läuft kostenlos auf
            dem Handy, du prüfst die Werte vor dem Speichern. Workouts kannst du zusätzlich in den Einstellungen per Liftoff-Login laden.
          </Empty>
        ) : (
          <>
            <div className="stats">
              {lift?.rank && <Stat label="Rang" value={lift.rank} />}
              {lift?.position !== undefined && (
                <Stat
                  label={lift.leaderboardName ?? 'Rangliste'}
                  value={`#${lift.position}`}
                  delta={ls.positionChange ? `${signed(ls.positionChange)} seit ${formatShort(ls.previous!.date.slice(0, 10))}` : lift.leaderboardSize ? `von ${lift.leaderboardSize}` : undefined}
                />
              )}
              {lift?.xp !== undefined && <Stat label="XP" value={lift.xp.toLocaleString('de-DE')} delta={ls.xpChange ? `${signed(ls.xpChange)} XP` : lift.level ? `Level ${lift.level}` : undefined} />}
              {lift?.streakDays !== undefined && <Stat label="Serie" value={`${lift.streakDays} T.`} />}
              <Stat label="Workouts" value={ls.workoutsLast7} delta={`7 Tage · ${ls.workoutsLast28} in 28 T.`} />
            </div>

            {lift && lift.leaderboard.length > 0 && (
              <>
                <div className="section-title">Rangliste</div>
                <ul className="list">
                  {lift.leaderboard.map((e) => (
                    <li key={`${e.position}-${e.name}`} className="row small">
                      <span className="strong" style={{ width: 32 }}>
                        #{e.position}
                      </span>
                      <span className={`grow ${e.isMe ? 'strong' : ''}`}>
                        {e.name}
                        {e.isMe && ' (du)'}
                      </span>
                      <span className="muted">{e.score?.toLocaleString('de-DE')}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {lift && lift.achievements.length > 0 && (
              <>
                <div className="section-title">
                  Errungenschaften ({ls.unlockedCount}/{ls.totalAchievements})
                </div>
                <div className="chips">
                  {lift.achievements.map((a) => (
                    <span key={a.name} className="pill" style={a.unlocked ? undefined : { opacity: 0.6 }}>
                      {a.unlocked ? '🏆' : '🔒'} {a.name}
                      {a.progress && !a.unlocked ? ` · ${a.progress}` : ''}
                    </span>
                  ))}
                </div>
                {ls.newAchievements.length > 0 && <p className="small">🎉 Neu freigeschaltet: {ls.newAchievements.join(', ')}</p>}
              </>
            )}

            {data.liftoff.workouts.length > 0 && (
              <>
                <div className="section-title">Letzte Workouts</div>
                <ul className="list">
                  {[...data.liftoff.workouts]
                    .reverse()
                    .slice(0, 5)
                    .map((w) => (
                      <li key={w.start} className="small">
                        <div className="row between">
                          <span className="strong">{w.title}</span>
                          <span className="muted">
                            {formatShort(new Date(w.start))} · {w.durationMin} min
                          </span>
                        </div>
                        {w.exercises && w.exercises.length > 0 && (
                          <div className="tiny muted">
                            {w.exercises.map((e) => `${e.name}${e.bestWeight ? ` ${e.bestWeight} kg` : ''}`).join(' · ')}
                          </div>
                        )}
                      </li>
                    ))}
                </ul>
              </>
            )}
            {data.liftoff.error && <div className="banner error small" style={{ marginTop: 8 }}>{data.liftoff.error}</div>}
            <div className="row wrap" style={{ marginTop: 12 }}>
              <button className="btn grow" onClick={importLiftoff} disabled={busy !== null}>
                {busy === 'liftoff' ? 'Lese Screenshots …' : 'Screenshots importieren'}
              </button>
              {!settings.liftoff.refreshToken && (
                <button className="btn ghost" onClick={() => go('einstellungen')}>
                  Liftoff-Login
                </button>
              )}
            </div>
            {lift && <p className="tiny muted" style={{ marginBottom: 0 }}>Stand: {formatDate(new Date(lift.date))} ({lift.source === 'manual' ? 'manuell' : lift.source === 'api' ? 'API' : 'Screenshot'})</p>}
          </>
        )}
      </Card>

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Meine Geräte">
        <p className="small muted" style={{ marginTop: 0 }}>
          Tippe an, was du hast. Körpergewichtsübungen gehen immer.
        </p>
        <div className="field">
          <span>Schnellauswahl</span>
          <div className="chips">
            {EQUIPMENT_PRESETS.map((p) => (
              <button key={p.label} className="chip" onClick={() => setEquipment(() => [...p.ids])}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {EQUIPMENT_GROUPS.map((g) => (
          <div key={g.label} className="field">
            <span>
              {g.label} ({g.ids.filter((id) => equipment.includes(id)).length}/{g.ids.length})
            </span>
            <div className="chips">
              {g.ids.map((id) => (
                <button key={id} className={`chip ${equipment.includes(id) ? 'on' : ''}`} onClick={() => toggleEquipment(id)}>
                  {EQUIPMENT[id]}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button className="btn primary block" onClick={() => setEditOpen(false)}>
          Fertig ({equipment.length} Geräte)
        </button>
      </Sheet>

      {detail && (
        <WorkoutDetailSheet
          workout={detail}
          onClose={() => setDetailId(null)}
          onExercise={(key, name) => {
            setDetailId(null);
            setProgress({ key, name });
          }}
          onDelete={() => {
            if (guardDemo()) return;
            void updateData((d) => ({ ...d, workoutLog: d.workoutLog.filter((w) => w.id !== detail.id) }));
            setDetailId(null);
            toast('Training gelöscht.');
          }}
        />
      )}

      {progress && <ExerciseProgressSheet log={data.workoutLog} exerciseKey={progress.key} name={progress.name} onClose={() => setProgress(null)} />}

      {liftoffDraft && (
        <LiftoffEntrySheet
          key={liftoffDraft.version}
          draft={liftoffDraft.draft}
          onClose={() => setLiftoffDraft(null)}
          onSave={async (snap) => {
            if (guardDemo()) return;
            await saveSnapshot(snap);
            setLiftoffDraft(null);
            toast('Liftoff-Werte gespeichert.');
          }}
        />
      )}
    </>
  );
}

/** Liftoff values – prefilled from screenshot text recognition, or empty for manual entry. */
function LiftoffEntrySheet({ draft, onClose, onSave }: { draft?: LiftoffDraft; onClose: () => void; onSave: (s: LiftoffSnapshot) => Promise<void> }) {
  const str = (v?: number | string) => (v === undefined ? '' : String(v));
  const [rank, setRank] = useState(draft?.rank ?? '');
  const [position, setPosition] = useState(str(draft?.position));
  const [xp, setXp] = useState(str(draft?.xp));
  const [level, setLevel] = useState(str(draft?.level));
  const [streak, setStreak] = useState(str(draft?.streakDays));
  const [picked, setPicked] = useState<Set<string>>(() => new Set(draft?.achievements.filter((a) => a.preselected).map((a) => a.name) ?? []));
  const [extra, setExtra] = useState('');
  const num = (v: string) => {
    const n = Number(v.replace(/[.\s]/g, '').replace(',', '.'));
    return v.trim() && Number.isFinite(n) ? n : undefined;
  };
  const toggle = (name: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });
  const candidates = draft?.achievements ?? [];
  return (
    <Sheet open onClose={onClose} title={draft ? 'Aus Screenshots erkannt' : 'Liftoff-Werte eintragen'}>
      {draft && (
        <p className="small muted" style={{ marginTop: 0 }}>
          Prüfe die erkannten Werte und korrigiere sie bei Bedarf.
        </p>
      )}
      <label className="field">
        <span>Rang / Liga</span>
        <input className="input" value={rank} onChange={(e) => setRank(e.target.value)} placeholder="z. B. Gold III" />
      </label>
      <div className="row">
        <label className="field grow">
          <span>Platz</span>
          <input className="input" inputMode="numeric" value={position} onChange={(e) => setPosition(e.target.value)} />
        </label>
        <label className="field grow">
          <span>XP</span>
          <input className="input" inputMode="numeric" value={xp} onChange={(e) => setXp(e.target.value)} />
        </label>
      </div>
      <div className="row">
        <label className="field grow">
          <span>Level</span>
          <input className="input" inputMode="numeric" value={level} onChange={(e) => setLevel(e.target.value)} />
        </label>
        <label className="field grow">
          <span>Serie (Tage)</span>
          <input className="input" inputMode="numeric" value={streak} onChange={(e) => setStreak(e.target.value)} />
        </label>
      </div>
      {draft && draft.leaderboard.length > 0 && (
        <p className="small secondary">
          Rangliste erkannt: {draft.leaderboard.length} Einträge
          {draft.leaderboard.some((e) => e.isMe) ? ' (inkl. deinem Platz)' : ''}.
        </p>
      )}
      {candidates.length > 0 && (
        <div className="field">
          <span>Errungenschaften – tippe an, was dazugehört</span>
          <div className="chips">
            {candidates.map((a) => (
              <button key={a.name} className={`chip ${picked.has(a.name) ? 'on' : ''}`} onClick={() => toggle(a.name)}>
                {a.unlocked ? '🏆' : '🔒'} {a.name}
                {a.progress ? ` · ${a.progress}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="field">
        <span>{candidates.length ? 'Weitere Errungenschaften' : 'Neue Errungenschaften'} (eine pro Zeile)</span>
        <textarea className="input" value={extra} onChange={(e) => setExtra(e.target.value)} />
      </label>
      <button
        className="btn primary block"
        onClick={() =>
          void onSave({
            date: new Date().toISOString(),
            source: draft ? 'screenshot' : 'manual',
            rank: rank.trim() || undefined,
            position: num(position),
            xp: num(xp),
            level: num(level),
            streakDays: num(streak),
            achievements: [
              ...candidates.filter((a) => picked.has(a.name)).map((a) => ({ name: a.name, unlocked: a.unlocked, progress: a.progress })),
              ...extra
                .split('\n')
                .map((a) => a.trim())
                .filter(Boolean)
                .map((name) => ({ name, unlocked: true })),
            ],
            leaderboard: draft?.leaderboard ?? [],
          })
        }
      >
        Speichern
      </button>
    </Sheet>
  );
}
