import { useState } from 'react';
import { mergeSessions } from '../../domain/oralb';
import { signed } from '../../domain/report';
import type { BrushSession } from '../../domain/types';
import { addDays, dayKey, formatMinutes, formatShort, formatTime, fromDayKey, WEEKDAYS_SHORT } from '../../lib/dates';
import { useStore } from '../../lib/store';
import { pickImages } from '../../integrations/camera';
import { readOralBScreenshots } from '../../integrations/claude';
import { BarChart, LineChart, type BarDatum } from '../charts';
import { Card, Empty, Segmented, Sheet, Stat, Status, toast, useAction } from '../components';
import { useNav } from '../nav';

type Tab = 'schlaf' | 'aktivitaet' | 'koerper' | 'zaehne';

export default function HealthScreen() {
  const { sub } = useNav();
  const [tab, setTab] = useState<Tab>((sub as Tab) || 'schlaf');
  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'schlaf', label: 'Schlaf' },
            { value: 'aktivitaet', label: 'Aktivität' },
            { value: 'koerper', label: 'Körper' },
            { value: 'zaehne', label: 'Zähne' },
          ]}
        />
      </div>
      {tab === 'schlaf' && <SleepTab />}
      {tab === 'aktivitaet' && <ActivityTab />}
      {tab === 'koerper' && <BodyTab />}
      {tab === 'zaehne' && <TeethTab />}
    </>
  );
}

function lastDays(n: number): string[] {
  const today = new Date();
  return Array.from({ length: n }, (_, i) => dayKey(addDays(today, i - n + 1)));
}

function SleepTab() {
  const { report, data, settings } = useStore();
  const [table, setTable] = useState(false);
  const s = report.sleep;
  const days = lastDays(14);
  const nights = days.map((d) => data.health.sleep.find((n) => n.date === d));
  const hasStages = nights.some((n) => n?.deep !== undefined);
  const bars: BarDatum[] = days.map((d, i) => {
    const n = nights[i];
    const label = WEEKDAYS_SHORT[fromDayKey(d).getDay()];
    if (!n) return { key: d, label, values: [0, 0, 0], readout: `${formatShort(d)}: keine Daten` };
    const hours = (v?: number) => (v ?? 0) / 60;
    const values = hasStages ? [hours(n.deep), hours(n.rem), hours(n.light)] : [hours(n.minutesAsleep), 0, 0];
    return {
      key: d,
      label,
      values,
      readout:
        `${formatShort(d)}: ${formatMinutes(n.minutesAsleep)} Schlaf, ${formatTime(new Date(n.start))}–${formatTime(new Date(n.end))}` +
        (hasStages ? ` · Tief ${formatMinutes(n.deep ?? 0)}, REM ${formatMinutes(n.rem ?? 0)}` : ''),
    };
  });

  return (
    <>
      <Card title="Schlafanalyse" icon="😴">
        {s.verdict === 'keine-daten' ? (
          <Empty>{s.tips[0]}</Empty>
        ) : (
          <>
            <Status level={s.verdict === 'gut' ? 'good' : s.verdict === 'ausbaufaehig' ? 'warning' : 'serious'}>
              {s.headline} · Score {s.score}/100
            </Status>
            {report.learning.active && (
              <div className="banner warn small" style={{ marginTop: 10 }}>
                <span aria-hidden>📚</span>
                <span>
                  {report.learning.reason}. Schlaf-Erinnerungen sind pausiert – kein Stress. (Tipp am Rande: Ausgeschlafen behältst du den Stoff
                  besser.)
                </span>
              </div>
            )}
            <div className="stats" style={{ marginTop: 12 }}>
              <Stat label="Ø Schlaf (7 N.)" value={formatMinutes(s.avgAsleepMin)} delta={s.deficitMin > 0 ? `${formatMinutes(s.deficitMin)} unter Ziel` : 'Ziel erreicht'} />
              <Stat label="Einschlafen" value={s.typicalBedtime ?? '–'} delta={`±${Math.round(s.bedtimeSpreadMin)} min`} />
              <Stat label="Aufwachen" value={s.typicalWake ?? '–'} />
              {s.avgEfficiency !== undefined && <Stat label="Effizienz" value={`${Math.round(s.avgEfficiency * 100)} %`} />}
              {s.deepPct !== undefined && <Stat label="Tiefschlaf" value={`${Math.round(s.deepPct * 100)} %`} delta={s.remPct !== undefined ? `REM ${Math.round(s.remPct * 100)} %` : undefined} />}
              {s.shouldImprove && <Stat label="Empfohlen ins Bett" value={s.recommendedBedtime ?? '–'} />}
            </div>
          </>
        )}
      </Card>

      {data.health.sleep.length > 0 && (
        <Card title="Letzte 14 Nächte" action={<button className="btn ghost" onClick={() => setTable(!table)}>{table ? 'Diagramm' : 'Tabelle'}</button>}>
          {table ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Nacht</th>
                  <th>Schlaf</th>
                  <th>Tief</th>
                  <th>REM</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d, i) => (
                  <tr key={d}>
                    <td>{formatShort(d)}</td>
                    <td>{nights[i] ? formatMinutes(nights[i]!.minutesAsleep) : '–'}</td>
                    <td>{nights[i]?.deep !== undefined ? formatMinutes(nights[i]!.deep!) : '–'}</td>
                    <td>{nights[i]?.rem !== undefined ? formatMinutes(nights[i]!.rem!) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <BarChart
              data={bars}
              ariaLabel="Schlafdauer der letzten 14 Nächte in Stunden"
              goal={settings.sleep.goalHours}
              goalLabel={`Ziel ${settings.sleep.goalHours} h`}
              formatY={(v) => `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} h`}
              series={
                hasStages
                  ? [
                      { label: 'Tiefschlaf', color: 'var(--series-1)' },
                      { label: 'REM', color: 'var(--series-2)' },
                      { label: 'Leichtschlaf', color: 'var(--series-3)' },
                    ]
                  : [{ label: 'Schlaf', color: 'var(--series-1)' }]
              }
            />
          )}
        </Card>
      )}

      {s.tips.length > 0 && s.verdict !== 'keine-daten' && (
        <Card title="Tipps" icon="💡">
          <ul className="bullets small">
            {s.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function ActivityTab() {
  const { report, data, settings } = useStore();
  const a = report.activity;
  const days = lastDays(14);
  const bars: BarDatum[] = days.map((d) => {
    const v = data.health.steps.find((s) => s.date === d)?.value ?? 0;
    return { key: d, label: WEEKDAYS_SHORT[fromDayKey(d).getDay()], values: [v], readout: `${formatShort(d)}: ${v.toLocaleString('de-DE')} Schritte` };
  });
  const rhr = data.health.restingHr.slice(-30).map((r) => ({ key: r.date, label: formatShort(r.date), value: r.value, readout: `${formatShort(r.date)}: ${r.value} bpm` }));

  if (!a.hasData && !rhr.length) {
    return (
      <Card title="Aktivität" icon="👟">
        <Empty>Noch keine Fitbit-Daten. Verbinde Health Connect in den Einstellungen und aktiviere dort in der Fitbit-App die Health-Connect-Synchronisierung.</Empty>
      </Card>
    );
  }
  return (
    <>
      <Card title="Schritte" icon="👟">
        <div className="stats" style={{ marginBottom: 10 }}>
          <Stat label="Heute" value={(a.todaySteps ?? 0).toLocaleString('de-DE')} />
          <Stat label="Ø 7 Tage" value={a.avgSteps.toLocaleString('de-DE')} delta={`Ziel ${a.goal.toLocaleString('de-DE')}`} />
          <Stat label="Ziel erreicht" value={`${a.daysGoalReached}/${a.days}`} delta="Tage" />
          {a.avgActiveCalories !== undefined && <Stat label="Aktive kcal" value={a.avgActiveCalories} delta="Ø pro Tag" />}
        </div>
        <BarChart data={bars} series={[{ label: 'Schritte', color: 'var(--series-1)' }]} goal={settings.training.stepsGoal} ariaLabel="Schritte der letzten 14 Tage" />
      </Card>
      {rhr.length > 1 && (
        <Card title="Ruhepuls" icon="💓">
          <div className="stats" style={{ marginBottom: 10 }}>
            <Stat label="Ø 7 Tage" value={`${a.avgRestingHr ?? '–'} bpm`} delta={a.restingHrTrend !== undefined ? `${signed(a.restingHrTrend, 1)} ggü. Vorwoche` : undefined} />
          </div>
          <LineChart points={rhr} ariaLabel="Ruhepuls der letzten 30 Tage" unit=" bpm" />
        </Card>
      )}
      {report.training.workouts.length > 0 && (
        <Card title="Aktivitäten" icon="🏃">
          <ul className="list">
            {[...report.training.workouts]
              .reverse()
              .slice(0, 8)
              .map((w) => (
                <li key={w.start} className="row small">
                  <span className="grow">
                    {w.title ?? w.type} <span className="muted">· {w.source}</span>
                  </span>
                  <span className="muted">
                    {formatShort(new Date(w.start))} · {w.durationMin} min
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function BodyTab() {
  const { report, data } = useStore();
  const b = report.body;
  const toPoints = (arr: { date: string; value: number }[], unit: string) =>
    [...arr]
      .sort((x, y) => x.date.localeCompare(y.date))
      .map((m) => ({ key: m.date, label: formatShort(new Date(m.date)), value: m.value, readout: `${formatShort(new Date(m.date))}: ${m.value.toLocaleString('de-DE')} ${unit}` }));
  const weight = toPoints(data.health.weight, 'kg');
  const fat = toPoints(data.health.bodyFat, '%');

  if (!weight.length && !data.health.bloodPressure.length) {
    return (
      <Card title="Körper" icon="⚖️">
        <Empty>Noch keine Withings-Daten. Verbinde Health Connect und aktiviere in der Withings-App (Health Mate) die Health-Connect-Synchronisierung.</Empty>
      </Card>
    );
  }
  return (
    <>
      {weight.length > 0 && (
        <Card title="Gewicht" icon="⚖️">
          <div className="stats" style={{ marginBottom: 10 }}>
            <Stat label="Aktuell" value={`${b.latestWeight!.value.toLocaleString('de-DE')} kg`} delta={b.latestWeight!.source} />
            {b.weightChange30 !== undefined && <Stat label="30 Tage" value={`${signed(b.weightChange30, 1)} kg`} />}
          </div>
          <LineChart points={weight} ariaLabel="Gewichtsverlauf" unit=" kg" />
        </Card>
      )}
      {fat.length > 1 && (
        <Card title="Körperfett" icon="📉">
          <div className="stats" style={{ marginBottom: 10 }}>
            <Stat label="Aktuell" value={`${b.latestBodyFat!.value.toLocaleString('de-DE')} %`} />
            {b.bodyFatChange30 !== undefined && <Stat label="30 Tage" value={`${signed(b.bodyFatChange30, 1)} %-Pkt.`} />}
          </div>
          <LineChart points={fat} ariaLabel="Körperfettverlauf" unit=" %" />
        </Card>
      )}
      {data.health.bloodPressure.length > 0 && (
        <Card title="Blutdruck" icon="🩺">
          <Status level={b.bpCategory === 'normal' ? 'good' : b.bpCategory === 'hoch-normal' || b.bpCategory === 'niedrig' ? 'warning' : 'critical'}>
            Zuletzt {b.latestBp!.systolic}/{b.latestBp!.diastolic} mmHg – {b.bpCategory}
          </Status>
          <table className="table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Sys/Dia</th>
              </tr>
            </thead>
            <tbody>
              {[...data.health.bloodPressure]
                .reverse()
                .slice(0, 8)
                .map((p) => (
                  <tr key={p.date}>
                    <td>{formatShort(new Date(p.date))}</td>
                    <td>
                      {p.systolic}/{p.diastolic}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="tiny muted" style={{ marginBottom: 0 }}>Keine medizinische Diagnose – bei dauerhaft auffälligen Werten bitte ärztlich abklären.</p>
        </Card>
      )}
    </>
  );
}

function TeethTab() {
  const { report, data, settings, updateData } = useStore();
  const { busy, run } = useAction();
  const [open, setOpen] = useState(false);
  const o = report.oral;
  const days = lastDays(14);
  const bars: BarDatum[] = days.map((d) => {
    const list = data.oralb.sessions.filter((s) => dayKey(new Date(s.date)) === d);
    return {
      key: d,
      label: WEEKDAYS_SHORT[fromDayKey(d).getDay()],
      values: [list.length],
      readout: `${formatShort(d)}: ${list.length}× geputzt${list.length ? ` (${list.map((s) => `${Math.round(s.durationSec)} s`).join(', ')})` : ''}`,
    };
  });

  const save = async (sessions: BrushSession[], streak?: number) => {
    if (settings.demoMode) {
      toast('Im Demo-Modus wird nichts gespeichert.');
      return;
    }
    await updateData((d) => ({
      ...d,
      oralb: { sessions: mergeSessions(d.oralb.sessions, sessions), streakDays: streak ?? d.oralb.streakDays, lastImport: new Date().toISOString() },
    }));
  };

  const importShots = () =>
    run('oralb', async () => {
      if (settings.demoMode) {
        toast('Im Demo-Modus wird nichts gespeichert.');
        return;
      }
      const images = await pickImages(6);
      if (!images.length) return;
      const res = await readOralBScreenshots(settings.anthropicApiKey, images);
      await save(res.sessions, res.streakDays);
      toast(`${res.sessions.length} Putzvorgänge importiert.`);
    });

  return (
    <>
      <Card title="Oral-B iO" icon="🪥">
        {!o.hasData ? (
          <Empty>{o.tips[0]}</Empty>
        ) : (
          <>
            <div className="stats" style={{ marginBottom: 10 }}>
              <Stat label="Pro Tag" value={`${o.sessionsPerDay.toFixed(1).replace('.', ',')}×`} delta="Ziel 2×" />
              <Stat label="Ø Dauer" value={`${Math.round(o.avgDurationSec)} s`} delta="Ziel 120 s" />
              {o.avgCoverage !== undefined && <Stat label="Abdeckung" value={`${Math.round(o.avgCoverage)} %`} />}
              <Stat label="Serie" value={`${o.streakDays} T.`} />
            </div>
            <BarChart data={bars} series={[{ label: 'Putzvorgänge', color: 'var(--series-1)' }]} goal={2} goalLabel="2× täglich" formatY={(v) => String(Math.round(v))} ariaLabel="Putzvorgänge pro Tag" />
            <ul className="bullets small" style={{ marginTop: 10 }}>
              {o.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </>
        )}
        <div className="row wrap" style={{ marginTop: 12 }}>
          <button className="btn primary grow" onClick={() => setOpen(true)}>
            Putzen eintragen
          </button>
          <button className="btn grow" onClick={importShots} disabled={busy !== null}>
            {busy === 'oralb' ? 'Lese Screenshots …' : 'Screenshot importieren'}
          </button>
        </div>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          Oral-B bietet keine offene Schnittstelle. Mach in der Oral-B-App Screenshots vom Verlauf/der Putzübersicht – Gig liest Dauer, Abdeckung und Druck
          automatisch aus.
        </p>
      </Card>
      <BrushSheet open={open} onClose={() => setOpen(false)} onSave={async (s) => { await save([s]); setOpen(false); toast('Gespeichert.'); }} />
    </>
  );
}

function BrushSheet({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (s: BrushSession) => Promise<void> }) {
  const [minutes, setMinutes] = useState('2');
  const [seconds, setSeconds] = useState('0');
  const [coverage, setCoverage] = useState('');
  const [when, setWhen] = useState<'jetzt' | 'morgens' | 'abends'>('jetzt');
  return (
    <Sheet open={open} onClose={onClose} title="Putzen eintragen">
      <Segmented
        value={when}
        onChange={setWhen}
        options={[
          { value: 'jetzt', label: 'Gerade eben' },
          { value: 'morgens', label: 'Heute früh' },
          { value: 'abends', label: 'Gestern Abend' },
        ]}
      />
      <div className="row" style={{ marginTop: 12 }}>
        <label className="field grow">
          <span>Minuten</span>
          <input className="input" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </label>
        <label className="field grow">
          <span>Sekunden</span>
          <input className="input" inputMode="numeric" value={seconds} onChange={(e) => setSeconds(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Abdeckung in % (optional, aus der Oral-B-App)</span>
        <input className="input" inputMode="numeric" value={coverage} onChange={(e) => setCoverage(e.target.value)} />
      </label>
      <button
        className="btn primary block"
        onClick={() => {
          const now = new Date();
          const date =
            when === 'jetzt'
              ? now
              : when === 'morgens'
                ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7)
                : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 21, 30);
          const cov = Number(coverage);
          void onSave({
            date: date.toISOString(),
            durationSec: (Number(minutes) || 0) * 60 + (Number(seconds) || 0),
            coveragePct: coverage.trim() && Number.isFinite(cov) ? cov : undefined,
            source: 'manual',
          });
        }}
      >
        Speichern
      </button>
    </Sheet>
  );
}
