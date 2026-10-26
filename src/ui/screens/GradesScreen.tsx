import { useMemo, useState } from 'react';
import { eventDayKey, KIND_LABEL } from '../../domain/calendar';
import {
  abiForecast,
  formatPoints,
  GRADE_TYPE_LABEL,
  matchSubject,
  newGradeId,
  pointsToGrade,
  semesterAverage,
  semesterForDate,
  SEMESTERS,
  subjectAverage,
  coursePoints,
} from '../../domain/grades';
import type { ClassifiedEvent, GradeEntry, GradeSettings, GradeType, Semester, Subject } from '../../domain/types';
import { dayKey, formatShort, relativeDays, daysBetween } from '../../lib/dates';
import { useStore } from '../../lib/store';
import { Card, Empty, Segmented, Sheet, toast } from '../components';

type View = '1' | '2' | '3' | '4' | 'abi';

const SUBJECT_EMOJI: [RegExp, string][] = [
  [/musik/i, '🎵'],
  [/englisch|franz|spanisch|latein|russisch|polnisch|sprache/i, '💬'],
  [/geschichte/i, '🏛️'],
  [/mathe/i, '📐'],
  [/physik/i, '⚛️'],
  [/chemie/i, '🧪'],
  [/deutsch/i, '✏️'],
  [/bio/i, '🧬'],
  [/erdkunde|geo/i, '🌍'],
  [/sport/i, '🏃'],
  [/politik|pb\b/i, '🏳️'],
  [/seminar/i, '📚'],
  [/kunst/i, '🎨'],
  [/informatik/i, '💻'],
  [/ler|religion|ethik|philo/i, '💭'],
  [/wirtschaft|wat/i, '📈'],
  [/astronomie/i, '🔭'],
  [/darstellend|theater/i, '🎭'],
];

const SUGGESTIONS = [
  'Deutsch', 'Mathematik', 'Englisch', 'Französisch', 'Spanisch', 'Latein', 'Russisch', 'Polnisch', 'Biologie', 'Chemie', 'Physik',
  'Informatik', 'Geschichte', 'Politik', 'Erdkunde', 'Wirtschaftswissenschaft', 'Kunst', 'Musik', 'Darstellendes Spiel', 'Sport', 'LER',
  'Philosophie', 'Astronomie', 'Seminarkurs',
];

export function subjectEmoji(name: string): string {
  return SUBJECT_EMOJI.find(([re]) => re.test(name))?.[1] ?? '📘';
}

/** Colour by points: 13+ keeps the streak (green), 10–12 blue, 5–9 yellow, below 5 red. */
export function pointsStyle(p: number | undefined): { background: string; color: string } {
  if (p === undefined) return { background: 'var(--surface-2)', color: 'var(--muted)' };
  if (p >= 12.95) return { background: 'var(--good)', color: '#fff' };
  if (p >= 9.95) return { background: 'var(--accent)', color: '#fff' };
  if (p >= 4.95) return { background: 'var(--warning)', color: '#0b0b0b' };
  return { background: 'var(--critical)', color: '#fff' };
}

export function GradeCircle({ value, size = 48 }: { value?: number; size?: number }) {
  return (
    <div className="grade-circle" style={{ width: size, height: size, fontSize: size * 0.32, ...pointsStyle(value) }}>
      {formatPoints(value)}
    </div>
  );
}

const TYPE_SHORT: Record<GradeType, string> = { klausur: 'K', test: 'T', muendlich: 'M', sonstige: '' };

export default function GradesScreen() {
  const { data, settings, report, updateData, updateSettings } = useStore();
  const gs = settings.grades;
  const { subjects, grades } = data.grades;
  const current = report.grades.semester;
  const [view, setView] = useState<View>(String(current) as View);
  const [entry, setEntry] = useState<{ subjectId?: string; event?: ClassifiedEvent; grade?: GradeEntry; key: number } | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const streak = report.grades.streak;

  const saveGrades = async (fn: (g: GradeEntry[]) => GradeEntry[]) => {
    if (settings.demoMode) {
      toast('Im Demo-Modus wird nichts gespeichert – beende zuerst die Demo.');
      return false;
    }
    await updateData((d) => ({ ...d, grades: { ...d.grades, grades: fn(d.grades.grades) } }));
    return true;
  };

  const saveSubjects = async (list: Subject[]) => {
    if (settings.demoMode) {
      toast('Im Demo-Modus wird nichts gespeichert.');
      return;
    }
    await updateData((d) => ({ ...d, grades: { ...d.grades, subjects: list } }));
  };

  const semester = view === 'abi' ? null : (Number(view) as Semester);
  const openSubject = subjects.find((s) => s.id === subjectId);

  return (
    <>
      <Card>
        <div className="streak">
          <span className="flame" aria-hidden>
            {streak.current > 0 ? '🔥' : '🧊'}
          </span>
          <div className="grow">
            <div>
              <span className="count">{streak.current}</span> <span className="secondary">Noten-Serie</span>
            </div>
            <div className="tiny muted">
              Tests & Klausuren ab {gs.streakMin} Punkten in Folge · Rekord {streak.best}
            </div>
          </div>
        </div>
        <p className="tiny muted" style={{ marginBottom: streak.next || streak.pending.length ? 8 : 0 }}>
          Die Serie läuft nicht nach einem Tag ab – sie richtet sich nur nach deinen Tests und Klausuren.
          {streak.next ? ` Nächste Chance: ${KIND_LABEL[streak.next.kind]} ${streak.next.subject ?? ''} ${relativeDays(daysBetween(new Date(), eventDayKey(streak.next)))} (${formatShort(eventDayKey(streak.next))}).` : ''}
        </p>
        {streak.pending.map((e) => (
          <div key={e.id} className="banner warn small" style={{ marginTop: 6 }}>
            <span aria-hidden>🎯</span>
            <span className="grow">
              {KIND_LABEL[e.kind]} {e.subject ?? e.title} vom {formatShort(eventDayKey(e))} – Punkte noch nicht eingetragen.
            </span>
            <button className="btn ghost" style={{ padding: '0 4px', minHeight: 0 }} onClick={() => setEntry({ event: e, key: Date.now() })}>
              Eintragen
            </button>
          </div>
        ))}
      </Card>

      <div className="row" style={{ marginBottom: 12 }}>
        <div className="grow seg-scroll">
          <Segmented<View>
            value={view}
            onChange={setView}
            options={[
              { value: '1', label: '1. HJ' },
              { value: '2', label: '2. HJ' },
              { value: '3', label: '3. HJ' },
              { value: '4', label: '4. HJ' },
              { value: 'abi', label: 'Abi' },
            ]}
          />
        </div>
        <button className="icon-btn" onClick={() => setSetupOpen(true)} aria-label="Fächer & Gewichtung">
          ⚙️
        </button>
      </div>

      {semester ? (
        <SemesterView
          semester={semester}
          isCurrent={semester === current}
          subjects={subjects}
          grades={grades}
          settings={gs}
          onSubject={setSubjectId}
          onAdd={() => setEntry({ key: Date.now() })}
        />
      ) : (
        <AbiView />
      )}

      {openSubject && semester && (
        <SubjectSheet
          subject={openSubject}
          semester={semester}
          grades={grades}
          settings={gs}
          onClose={() => setSubjectId(null)}
          onAdd={() => setEntry({ subjectId: openSubject.id, key: Date.now() })}
          onEdit={(g) => setEntry({ grade: g, key: Date.now() })}
        />
      )}

      {entry && (
        <GradeEntrySheet
          key={entry.key}
          subjects={subjects}
          settings={gs}
          initial={entry}
          defaultSemester={semester ?? current}
          onClose={() => setEntry(null)}
          onDelete={async (id) => {
            if (await saveGrades((list) => list.filter((g) => g.id !== id))) {
              setEntry(null);
              toast('Note gelöscht.');
            }
          }}
          onSave={async (g) => {
            const ok = await saveGrades((list) => [...list.filter((x) => x.id !== g.id), g]);
            if (!ok) return;
            setEntry(null);
            const subj = subjects.find((s) => s.id === g.subjectId)?.name;
            if (g.type === 'klausur' || g.type === 'test') {
              toast(g.points >= gs.streakMin ? `🔥 ${g.points} Punkte in ${subj} – die Serie hält!` : `${g.points} Punkte in ${subj} gespeichert. Die Serie startet beim nächsten Test neu.`);
            } else toast(`${g.points} Punkte in ${subj} gespeichert.`);
          }}
        />
      )}

      {setupOpen && (
        <SetupSheet
          subjects={subjects}
          settings={gs}
          onClose={() => setSetupOpen(false)}
          onSubjects={saveSubjects}
          onSettings={(patch) => void updateSettings((s) => ({ ...s, grades: { ...s.grades, ...patch } }))}
        />
      )}
    </>
  );
}

function SemesterView({
  semester,
  isCurrent,
  subjects,
  grades,
  settings,
  onSubject,
  onAdd,
}: {
  semester: Semester;
  isCurrent: boolean;
  subjects: Subject[];
  grades: GradeEntry[];
  settings: GradeSettings;
  onSubject: (id: string) => void;
  onAdd: () => void;
}) {
  const avg = semesterAverage(subjects, grades, semester, settings);
  // Subjects with grades first (best first), then the rest – like Notan.
  const rows = subjects
    .map((s) => ({ s, avg: subjectAverage(s, grades, semester, settings), list: grades.filter((g) => g.subjectId === s.id && g.semester === semester).sort((a, b) => a.date.localeCompare(b.date)) }))
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  return (
    <>
      <Card>
        <div style={{ display: 'grid', placeItems: 'center', gap: 8 }}>
          <GradeCircle value={avg} size={96} />
          <div className="strong" style={{ letterSpacing: '0.12em' }}>
            {semester}. Halbjahr{isCurrent ? ' · aktuell' : ''}
          </div>
          {avg !== undefined && <div className="small muted">≈ Note {pointsToGrade(avg)} · LK zählen doppelt</div>}
        </div>
        <button className="btn primary block" style={{ marginTop: 14 }} onClick={onAdd}>
          + Note eintragen
        </button>
      </Card>
      <Card>
        {subjects.length === 0 ? (
          <Empty>Noch keine Fächer – tippe oben auf ⚙️, um deine Fächer anzulegen.</Empty>
        ) : (
          rows.map(({ s, avg: a, list }) => (
            <button key={s.id} className="subject-row" onClick={() => onSubject(s.id)}>
              <span className="emoji" aria-hidden>
                {subjectEmoji(s.name)}
              </span>
              <span>
                <span className="strong">{s.name}</span>
                {s.lk && <span className="lk-badge">2x</span>}
                {list.length > 0 && (
                  <span className="chips" style={{ marginTop: 6, gap: 6 }}>
                    {list.map((g) => (
                      <span key={g.id} className={`grade-chip ${TYPE_SHORT[g.type] ? 'typed' : ''}`} data-type={TYPE_SHORT[g.type]} style={pointsStyle(g.points)} title={GRADE_TYPE_LABEL[g.type]}>
                        {g.points}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <GradeCircle value={a} />
            </button>
          ))
        )}
        <p className="tiny muted" style={{ marginBottom: 0, marginTop: 10 }}>
          K = Klausur, T = Test, M = mündlich. Keine Garantie für die Richtigkeit der Berechnungen.
        </p>
      </Card>
    </>
  );
}

function AbiView() {
  const { data, settings, report } = useStore();
  const gs = settings.grades;
  const b = report.grades.blockI;
  const [exam, setExam] = useState<number | null>(null);
  const forecast = useMemo(() => abiForecast(b, exam ?? undefined), [b, exam]);
  const { subjects, grades } = data.grades;
  const lkCount = Math.min(b.lkCourses.length, b.lkNeeded);
  return (
    <>
      <Card title="Abi-Prognose" icon="🎓">
        {forecast.grade === undefined ? (
          <Empty>Trag Noten ein, dann siehst du hier deine Prognose.</Empty>
        ) : (
          <>
            <div className="hero">
              <div className="hero-number">{forecast.grade.toFixed(1).replace('.', ',')}</div>
              <div className="small secondary">
                {forecast.total} von 900 Punkten
                <br />
                Block I: {forecast.blockI} / 600 · Block II: {forecast.blockII} / 300
              </div>
            </div>
            <label className="field" style={{ marginTop: 14 }}>
              <span>Angenommene Punkte in den 5 Abiturprüfungen: {forecast.examPoints}</span>
              <input type="range" min={0} max={15} step={1} value={forecast.examPoints} style={{ width: '100%' }} onChange={(e) => setExam(Number(e.target.value))} />
            </label>
            <p className="tiny muted" style={{ margin: 0 }}>
              Block I wird aus deinem bisherigen Schnitt hochgerechnet. Abiturnote nach KMK: 5⅔ − Gesamtpunkte ÷ 180.
            </p>
          </>
        )}
      </Card>

      <Card title="Block I – Qualifikationsphase" icon="📊">
        <div className="stats">
          <div className="stat">
            <div className="label">{b.complete ? 'Ergebnis' : 'Hochrechnung'}</div>
            <div className="value">{b.current ?? b.projected ?? '–'}</div>
            <div className="delta">von 600 (mind. 200)</div>
          </div>
          <div className="stat">
            <div className="label">LK-Halbjahre</div>
            <div className="value">
              {lkCount}/{b.lkNeeded}
            </div>
            <div className="delta">zählen doppelt</div>
          </div>
          <div className="stat">
            <div className="label">Grundkurse</div>
            <div className="value">
              {b.countedGk.length}/{b.gkNeeded}
            </div>
            <div className="delta">beste werden gezählt</div>
          </div>
          <div className="stat">
            <div className="label">Unter 5 Punkten</div>
            <div className="value">{b.lkUnder5 + b.gkUnder5}</div>
            <div className="delta">
              LK {b.lkUnder5} · GK {b.gkUnder5}
            </div>
          </div>
        </div>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          Brandenburg, § 30 GOSTV: alle 8 Halbjahre der Leistungskurse doppelt, dazu {gs.blockIGrundkurse} Grundkurs-Halbjahre (inkl. 3./4. Prüfungsfach). E I = P ÷ S × 40
          {b.weightCount ? ` – bei dir bisher ${b.points} ÷ ${b.weightCount} × 40` : ''}. Kurse mit 0 Punkten können nicht eingebracht werden. Welche
          Grundkurse Pflicht sind, legt deine Schule fest.
        </p>
      </Card>

      <Card title="Alle Halbjahre" icon="🗂️">
        <table className="table">
          <thead>
            <tr>
              <th>Fach</th>
              {SEMESTERS.map((s) => (
                <th key={s} className="num">
                  {s}.
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.name}
                  {s.lk ? ' (LK)' : ''}
                </td>
                {SEMESTERS.map((sem) => {
                  const a = subjectAverage(s, grades, sem, gs);
                  return (
                    <td key={sem} className="num">
                      {a === undefined ? '–' : coursePoints(a)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          Ganze Kurspunkte (ab ,5 aufgerundet), so wie sie ins Abi eingehen. Die endgültige Kursnote setzt die Lehrkraft fest.
        </p>
      </Card>
    </>
  );
}

function SubjectSheet({
  subject,
  semester,
  grades,
  settings,
  onClose,
  onAdd,
  onEdit,
}: {
  subject: Subject;
  semester: Semester;
  grades: GradeEntry[];
  settings: GradeSettings;
  onClose: () => void;
  onAdd: () => void;
  onEdit: (g: GradeEntry) => void;
}) {
  const list = grades.filter((g) => g.subjectId === subject.id && g.semester === semester).sort((a, b) => b.date.localeCompare(a.date));
  const avg = subjectAverage(subject, grades, semester, settings);
  return (
    <Sheet open onClose={onClose} title={`${subjectEmoji(subject.name)} ${subject.name}${subject.lk ? ' (LK)' : ''}`}>
      <div className="row" style={{ marginBottom: 12 }}>
        <GradeCircle value={avg} size={56} />
        <div className="small secondary grow">
          {semester}. Halbjahr · {list.length} Note{list.length === 1 ? '' : 'n'}
          {avg !== undefined && ` · ≈ ${pointsToGrade(avg)}`}
          <br />
          {subject.lk ? 'Leistungskurs – zählt doppelt.' : 'Grundkurs.'}
        </div>
      </div>
      {list.length === 0 ? (
        <Empty>Noch keine Noten in diesem Halbjahr.</Empty>
      ) : (
        <ul className="list">
          {list.map((g) => (
            <li key={g.id}>
              <button className="row" style={{ width: '100%', background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => onEdit(g)}>
                <span className="grade-chip" style={pointsStyle(g.points)}>
                  {g.points}
                </span>
                <span className="grow small">
                  {GRADE_TYPE_LABEL[g.type]}
                  {g.note ? ` · ${g.note}` : ''}
                </span>
                <span className="small muted">{formatShort(g.date)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="btn primary block" style={{ marginTop: 12 }} onClick={onAdd}>
        + Note in {subject.name}
      </button>
    </Sheet>
  );
}

function GradeEntrySheet({
  subjects,
  settings,
  initial,
  defaultSemester,
  onClose,
  onSave,
  onDelete,
}: {
  subjects: Subject[];
  settings: GradeSettings;
  initial: { subjectId?: string; event?: ClassifiedEvent; grade?: GradeEntry };
  defaultSemester: Semester;
  onClose: () => void;
  onSave: (g: GradeEntry) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const ev = initial.event;
  const existing = initial.grade;
  const today = dayKey(new Date());
  const [subjectId, setSubjectId] = useState(
    existing?.subjectId ?? initial.subjectId ?? (ev ? matchSubject(ev.subject ?? ev.title, subjects)?.id : undefined) ?? subjects[0]?.id ?? '',
  );
  const [points, setPoints] = useState<number | null>(existing?.points ?? null);
  const [type, setType] = useState<GradeType>(existing?.type ?? (ev ? (ev.kind === 'klausur' ? 'klausur' : 'test') : 'klausur'));
  const [date, setDate] = useState(existing?.date ?? (ev ? eventDayKey(ev) : today));
  const autoSemester = semesterForDate(date, settings.qPhaseStartYear);
  const [semester, setSemester] = useState<Semester>(existing?.semester ?? (ev || date !== today ? autoSemester : defaultSemester));
  const [note, setNote] = useState(existing?.note ?? '');

  return (
    <Sheet open onClose={onClose} title={existing ? 'Note bearbeiten' : ev ? `${KIND_LABEL[ev.kind]} vom ${formatShort(eventDayKey(ev))}` : 'Note eintragen'}>
      <div className="field">
        <span>Fach</span>
        <div className="chips">
          {subjects.map((s) => (
            <button key={s.id} className={`chip ${subjectId === s.id ? 'on' : ''}`} onClick={() => setSubjectId(s.id)}>
              {s.name}
              {s.lk ? ' (LK)' : ''}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Punkte{points !== null ? ` – ${points} (Note ${pointsToGrade(points)})` : ''}</span>
        <div className="points-grid">
          {Array.from({ length: 16 }, (_, i) => 15 - i).map((p) => (
            <button key={p} className={points === p ? 'on' : ''} style={pointsStyle(p)} onClick={() => setPoints(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Art</span>
        <Segmented<GradeType>
          value={type}
          onChange={setType}
          options={[
            { value: 'klausur', label: 'Klausur' },
            { value: 'test', label: 'Test' },
            { value: 'muendlich', label: 'Mündlich' },
            { value: 'sonstige', label: 'Sonstige' },
          ]}
        />
        {(type === 'klausur' || type === 'test') && (
          <span className="tiny muted" style={{ display: 'block', marginTop: 4 }}>
            Zählt für die Noten-Serie (ab {settings.streakMin} Punkten).
          </span>
        )}
      </div>
      <div className="row">
        <label className="field grow">
          <span>Datum</span>
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => {
              const v = e.target.value || today;
              setDate(v);
              setSemester(semesterForDate(v, settings.qPhaseStartYear));
            }}
          />
        </label>
        <label className="field">
          <span>Halbjahr</span>
          <select className="input" value={semester} onChange={(e) => setSemester(Number(e.target.value) as Semester)}>
            {SEMESTERS.map((s) => (
              <option key={s} value={s}>
                {s}. HJ
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Notiz (optional)</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Thema" />
      </label>
      <button
        className="btn primary block"
        disabled={points === null || !subjectId}
        onClick={() =>
          void onSave({
            id: existing?.id ?? newGradeId(),
            subjectId,
            points: points ?? 0,
            type,
            date,
            semester,
            eventId: existing?.eventId ?? ev?.id,
            note: note.trim() || undefined,
          })
        }
      >
        Speichern
      </button>
      {existing && (
        <button className="btn block danger" style={{ marginTop: 8 }} onClick={() => void onDelete(existing.id)}>
          Note löschen
        </button>
      )}
    </Sheet>
  );
}

function SetupSheet({
  subjects,
  settings,
  onClose,
  onSubjects,
  onSettings,
}: {
  subjects: Subject[];
  settings: GradeSettings;
  onClose: () => void;
  onSubjects: (s: Subject[]) => Promise<void>;
  onSettings: (patch: Partial<GradeSettings>) => void;
}) {
  const [name, setName] = useState('');
  const add = (n: string) => {
    const clean = n.trim();
    if (!clean || subjects.some((s) => s.name.toLowerCase() === clean.toLowerCase())) return;
    const id = `${clean.toLowerCase().replace(/[^a-zäöüß0-9]+/g, '-')}-${Date.now().toString(36)}`;
    void onSubjects([...subjects, { id, name: clean, lk: false }]);
    setName('');
  };
  const lkCount = subjects.filter((s) => s.lk).length;
  return (
    <Sheet open onClose={onClose} title="Fächer & Gewichtung">
      <div className="section-title" style={{ marginTop: 0 }}>
        Deine Fächer
      </div>
      <ul className="list">
        {subjects.map((s) => (
          <li key={s.id} className="row">
            <span aria-hidden>{subjectEmoji(s.name)}</span>
            <span className="grow">{s.name}</span>
            <button className={`chip ${s.lk ? 'on' : ''}`} onClick={() => void onSubjects(subjects.map((x) => (x.id === s.id ? { ...x, lk: !x.lk } : x)))}>
              {s.lk ? 'LK · 2x' : 'GK · 1x'}
            </button>
            <select
              className="input"
              style={{ width: 'auto', minHeight: 36, padding: '4px 8px' }}
              value={s.klausurShare ?? ''}
              aria-label={`Klausur-Anteil ${s.name}`}
              onChange={(e) => void onSubjects(subjects.map((x) => (x.id === s.id ? { ...x, klausurShare: e.target.value === '' ? null : Number(e.target.value) } : x)))}
            >
              <option value="">Standard</option>
              <option value="0">K 0 %</option>
              <option value="25">K 25 %</option>
              <option value="33">K 33 %</option>
              <option value="50">K 50 %</option>
              <option value="67">K 67 %</option>
            </select>
            <button className="btn ghost danger" style={{ padding: '0 4px' }} aria-label={`${s.name} entfernen`} onClick={() => void onSubjects(subjects.filter((x) => x.id !== s.id))}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      {lkCount !== 2 && <p className="tiny muted">In Brandenburg hast du normalerweise 2 Leistungskurse – gerade sind {lkCount} markiert.</p>}
      <div className="row" style={{ marginTop: 10 }}>
        <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fach hinzufügen" />
        <button className="btn" onClick={() => add(name)}>
          +
        </button>
      </div>
      <div className="chips" style={{ marginTop: 8 }}>
        {SUGGESTIONS.filter((n) => !subjects.some((s) => s.name === n)).map((n) => (
          <button key={n} className="chip" onClick={() => add(n)}>
            + {n}
          </button>
        ))}
      </div>

      <div className="section-title">Gewichtung im Fach</div>
      <Segmented<GradeSettings['weighting']>
        value={settings.weighting}
        onChange={(v) => onSettings({ weighting: v })}
        options={[
          { value: 'gleich', label: 'Alle gleich' },
          { value: 'drittel', label: 'Klausur ⅓' },
          { value: 'haelfte', label: 'Klausur ½' },
        ]}
      />
      <p className="tiny muted">
        „Alle gleich“ rechnet wie Notan (Durchschnitt aller Noten). In Brandenburg legt die Lehrkraft zu Kursbeginn fest, wie Klausuren gewichtet werden – oft
        zu einem Drittel. Pro Fach kannst du oben einen eigenen Klausur-Anteil (K) wählen.
      </p>

      <div className="section-title">Abitur</div>
      <label className="field">
        <span>Qualifikationsphase begann im August</span>
        <select className="input" value={settings.qPhaseStartYear} onChange={(e) => onSettings({ qPhaseStartYear: Number(e.target.value) })}>
          {[0, -1, -2, 1].map((d) => {
            const y = new Date().getFullYear() + d;
            return (
              <option key={y} value={y}>
                {y} (Abitur {y + 2})
              </option>
            );
          })}
        </select>
      </label>
      <label className="field">
        <span>Grundkurs-Halbjahre in Block I</span>
        <select className="input" value={settings.blockIGrundkurse} onChange={(e) => onSettings({ blockIGrundkurse: Number(e.target.value) })}>
          <option value={28}>28 (aktuelle GOSTV)</option>
          <option value={30}>30 (ältere Fassung)</option>
        </select>
      </label>
      <label className="field">
        <span>Noten-Serie hält ab</span>
        <select className="input" value={settings.streakMin} onChange={(e) => onSettings({ streakMin: Number(e.target.value) })}>
          {[10, 11, 12, 13, 14, 15].map((p) => (
            <option key={p} value={p}>
              {p} Punkten
            </option>
          ))}
        </select>
      </label>
      <button className="btn primary block" style={{ marginTop: 8 }} onClick={onClose}>
        Fertig
      </button>
    </Sheet>
  );
}
