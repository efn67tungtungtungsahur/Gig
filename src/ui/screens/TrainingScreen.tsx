import { useMemo, useState } from 'react';
import { eventDayKey, upcoming } from '../../domain/calendar';
import { EQUIPMENT, EQUIPMENT_IDS, MUSCLE_LABEL } from '../../domain/exercises';
import { latestSnapshot } from '../../domain/liftoff';
import { planTraining } from '../../domain/planner';
import { signed } from '../../domain/report';
import type { LiftoffSnapshot, MuscleGroup } from '../../domain/types';
import { formatDate, formatShort, formatTime } from '../../lib/dates';
import { useStore } from '../../lib/store';
import { parseLiftoffText, type LiftoffDraft } from '../../domain/ocrParse';
import type { Detection } from '../../domain/visionLabels';
import { pickImages, takePhoto, type ImageInput } from '../../integrations/camera';
import { readScreenshots } from '../../integrations/ocr';
import { scanRoom } from '../../integrations/vision';
import type { VisionProgress } from '../../integrations/visionEngine';
import { Card, Empty, Sheet, Stat, toast, useAction } from '../components';
import { IconCamera } from '../icons';
import { useNav } from '../nav';

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
  const [previews, setPreviews] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [progress, setProgress] = useState<VisionProgress | null>(null);
  const [review, setReview] = useState<Detection[] | null>(null);
  const [liftoffDraft, setLiftoffDraft] = useState<{ draft?: LiftoffDraft; version: number } | null>(null);
  const trainings = upcoming(report.events, new Date(), ['training'], 14);
  const [selected, setSelected] = useState<string | 'frei'>(trainings[0]?.id ?? 'frei');
  const [freeFocus, setFreeFocus] = useState(0);

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

  const scan = (source: 'kamera' | 'galerie') =>
    run('scan', async () => {
      if (guardDemo()) return;
      let images: ImageInput[] = [];
      if (source === 'kamera') {
        const shot = await takePhoto();
        if (shot) images = [shot.image];
      } else {
        images = await pickImages(4);
      }
      if (!images.length) return;
      setPreviews((p) => [...p, ...images.map((i) => `data:${i.mediaType};base64,${i.base64}`)]);
      setProgress({ phase: 'laden', percent: 0 });
      try {
        const found = await scanRoom(images, setProgress);
        setReview(found);
      } finally {
        setProgress(null);
      }
    });

  const confirmScan = async (ids: string[]) => {
    await updateData((d) => ({
      ...d,
      gym: {
        ...d.gym,
        equipment: [...new Set([...d.gym.equipment, ...ids])],
        scannedAt: new Date().toISOString(),
        photosScanned: d.gym.photosScanned + 1,
      },
    }));
    setReview(null);
    toast(ids.length ? `${ids.length} Geräte übernommen. Tipp: Fotografiere auch die anderen Ecken.` : 'Nichts übernommen.');
  };

  const toggleEquipment = (id: string) => {
    if (guardDemo()) return;
    void updateData((d) => ({
      ...d,
      gym: { ...d.gym, equipment: d.gym.equipment.includes(id) ? d.gym.equipment.filter((e) => e !== id) : [...d.gym.equipment, id] },
    }));
  };

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

  return (
    <>
      <Card title="Trainingsraum scannen" icon="📷">
        <p className="small secondary" style={{ marginTop: 0 }}>
          Fotografiere deinen Trainingsraum (gern mehrere Fotos aus verschiedenen Ecken). Die Bilderkennung auf deinem Handy erkennt die sichtbaren Geräte – daraus entstehen
          deine Übungsvorschläge.
        </p>
        {previews.length > 0 && (
          <div className="photo-strip" style={{ marginBottom: 10 }}>
            {previews.map((p, i) => (
              <img key={i} src={p} alt={`Foto ${i + 1}`} />
            ))}
          </div>
        )}
        <div className="row wrap">
          <button className="btn primary grow" onClick={() => scan('kamera')} disabled={busy !== null}>
            <IconCamera width={20} height={20} />
            {equipment.length ? 'Weiteres Foto scannen' : 'Foto aufnehmen & scannen'}
          </button>
          <button className="btn grow" onClick={() => scan('galerie')} disabled={busy !== null}>
            Aus der Galerie
          </button>
        </div>
        {progress && (
          <div className="banner info small" style={{ marginTop: 10 }}>
            <span aria-hidden>⏳</span>
            <span className="grow">
              {progress.phase === 'laden' ? 'Erkennungsmodell wird geladen' : 'Analysiere Foto'} … {progress.percent} %
              <div style={{ height: 4, borderRadius: 2, background: 'var(--accent-soft)', marginTop: 6 }}>
                <div style={{ width: `${progress.percent}%`, height: 4, borderRadius: 2, background: 'var(--accent)' }} />
              </div>
            </span>
          </div>
        )}
        <button className="btn ghost" style={{ marginTop: 6, paddingLeft: 0 }} onClick={() => setEditOpen(true)}>
          Geräte von Hand auswählen
        </button>
        <p className="tiny muted" style={{ margin: 0 }}>
          Kostenlos und auf dem Handy: Beim ersten Scan wird das offene Erkennungsmodell einmalig heruntergeladen (WLAN empfohlen), danach geht es
          offline. Prüfe die Vorschläge kurz – nicht jedes Gerät wird sicher erkannt.
        </p>
        {equipment.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 14 }}>
              Erkannte Geräte ({equipment.length})
            </div>
            <div className="chips">
              {equipment.map((id) => (
                <span key={id} className="pill">
                  {EQUIPMENT[id] ?? id}
                </span>
              ))}
            </div>
            {data.gym.scannedAt && <p className="tiny muted" style={{ margin: 0 }}>Zuletzt gescannt am {formatDate(new Date(data.gym.scannedAt))}</p>}
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

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Geräte im Trainingsraum">
        <p className="small muted" style={{ marginTop: 0 }}>
          Tippe an, was in deinem Raum steht. Körpergewichtsübungen gehen immer.
        </p>
        <div className="chips">
          {EQUIPMENT_IDS.map((id) => (
            <button key={id} className={`chip ${equipment.includes(id) ? 'on' : ''}`} onClick={() => toggleEquipment(id)}>
              {EQUIPMENT[id]}
            </button>
          ))}
        </div>
      </Sheet>

      {review && <ScanReviewSheet detections={review} known={equipment} onClose={() => setReview(null)} onConfirm={confirmScan} />}

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

/** Lets you confirm what the room scan found before it is saved. */
function ScanReviewSheet({
  detections,
  known,
  onClose,
  onConfirm,
}: {
  detections: Detection[];
  known: string[];
  onClose: () => void;
  onConfirm: (ids: string[]) => Promise<void>;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(detections.filter((d) => d.confidence >= 0.3).map((d) => d.id)));
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <Sheet open onClose={onClose} title="Erkannte Geräte">
      {detections.length === 0 ? (
        <p className="small muted" style={{ marginTop: 0 }}>
          Auf dem Foto wurden keine Trainingsgeräte erkannt. Versuch es mit einem anderen Blickwinkel oder wähle die Geräte von Hand aus.
        </p>
      ) : (
        <>
          <p className="small muted" style={{ marginTop: 0 }}>
            Tippe an, was wirklich da ist. Die Prozentzahl zeigt, wie sicher sich die Erkennung ist.
          </p>
          <div className="chips" style={{ marginBottom: 14 }}>
            {detections.map((d) => (
              <button key={d.id} className={`chip ${picked.has(d.id) ? 'on' : ''}`} onClick={() => toggle(d.id)}>
                {EQUIPMENT[d.id] ?? d.id} · {Math.round(d.confidence * 100)} %{known.includes(d.id) ? ' (schon dabei)' : ''}
              </button>
            ))}
          </div>
        </>
      )}
      <button className="btn primary block" onClick={() => void onConfirm([...picked])}>
        {picked.size ? `${picked.size} Geräte übernehmen` : 'Schließen'}
      </button>
    </Sheet>
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
