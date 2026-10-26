import { eventDayKey, KIND_LABEL } from '../../domain/calendar';
import { latestSnapshot } from '../../domain/liftoff';
import { mergeSessions } from '../../domain/oralb';
import { signed } from '../../domain/report';
import { daysBetween, formatMinutes, formatShort, formatTime, relativeDays } from '../../lib/dates';
import { useStore } from '../../lib/store';
import { Card, Empty, ScoreRing, Stat, Status, scoreLevel, toast } from '../components';
import { useNav } from '../nav';

export default function Dashboard() {
  const { report, settings, data, updateSettings, updateData } = useStore();
  const { go } = useNav();
  const { sleep, learning, activity, body, training, oral, holidays, exams } = report;
  const nothingConnected =
    !settings.icsUrls.length && !settings.healthConnected && !settings.liftoff.refreshToken && !data.oralb.sessions.length;
  const lift = latestSnapshot(data.liftoff);

  const logBrushing = async () => {
    if (settings.demoMode) {
      toast('Im Demo-Modus wird nichts gespeichert.');
      return;
    }
    await updateData((d) => ({
      ...d,
      oralb: { ...d.oralb, sessions: mergeSessions(d.oralb.sessions, [{ date: new Date().toISOString(), durationSec: 120, source: 'manual' }]) },
    }));
    toast('Putzvorgang (2:00 min) gespeichert. Details unter Gesundheit → Zähne.');
  };

  return (
    <>
      {!settings.welcomeDone && nothingConnected && !settings.demoMode && (
        <Card title="Willkommen bei Gig 👋">
          <p className="secondary" style={{ marginTop: 0 }}>
            Gig bündelt deinen Google Kalender, Fitbit, Withings, Liftoff und deine Oral-B iO an einem Ort, wertet alles aus und erinnert dich an
            Tests, Klausuren und Ferien.
          </p>
          <div className="row wrap">
            <button className="btn primary grow" onClick={() => go('einstellungen')}>
              Jetzt einrichten
            </button>
            <button className="btn grow" onClick={() => updateSettings((s) => ({ ...s, demoMode: true }))}>
              Demo ansehen
            </button>
          </div>
        </Card>
      )}

      {settings.demoMode && (
        <div className="banner info" style={{ marginBottom: 12 }}>
          <span aria-hidden>🧪</span>
          <span className="grow">
            Demo-Modus: Es werden Beispieldaten angezeigt.{' '}
            <button className="btn ghost" style={{ padding: 0, minHeight: 0 }} onClick={() => updateSettings((s) => ({ ...s, demoMode: false, welcomeDone: true }))}>
              Demo beenden
            </button>
          </span>
        </div>
      )}

      <Card>
        <div className="hero">
          <div>
            <div className="muted small">Gesamt-Score</div>
            <div className="hero-number">{report.overallScore ?? '–'}</div>
            <Status level={scoreLevel(report.overallScore)}>
              {report.overallScore === undefined ? 'Noch keine Daten' : report.overallScore >= 80 ? 'Läuft richtig gut' : report.overallScore >= 60 ? 'Solide, mit Luft nach oben' : 'Da geht noch was'}
            </Status>
          </div>
        </div>
        <div className="row between" style={{ marginTop: 14 }}>
          {report.areas.map((a) => (
            <ScoreRing key={a.key} score={a.score} size={54} label={a.label} />
          ))}
        </div>
        <button className="btn block" style={{ marginTop: 14 }} onClick={() => go('bericht')}>
          📊 Gesamt-Update ansehen
        </button>
      </Card>

      {learning.active && (
        <div className="banner warn" style={{ marginBottom: 12 }}>
          <span aria-hidden>📚</span>
          <span>
            <strong>{learning.reason}</strong>
            <br />
            <span className="small">Schlaf-Erinnerungen sind pausiert, damit du dich aufs Lernen konzentrieren kannst.</span>
          </span>
        </div>
      )}

      <Card title="Schule" icon="🎓" action={<button className="btn ghost" onClick={() => go('kalender')}>Alle</button>}>
        <div className="row" style={{ alignItems: 'flex-end', marginBottom: 12 }}>
          {holidays.current ? (
            <div>
              <div className="countdown">{holidays.currentDaysLeft}</div>
              <div className="small secondary">Tage {holidays.current.name} übrig · Schule ab {formatShort(holidays.backToSchool!)}</div>
            </div>
          ) : holidays.next ? (
            <div>
              <div className="countdown">{holidays.daysUntilNext}</div>
              <div className="small secondary">
                Tage bis zu den {holidays.next.name} ({formatShort(holidays.next.start)}) · {holidays.schoolDaysUntilNext} Schultage
              </div>
            </div>
          ) : (
            <div className="muted small">Keine Ferientermine</div>
          )}
        </div>
        {exams.length === 0 ? (
          <Empty>
            {settings.icsUrls.length || settings.demoMode
              ? 'Keine Tests oder Klausuren in den nächsten 60 Tagen.'
              : 'Verbinde deinen Google Kalender, damit Tests und Klausuren erkannt werden.'}
          </Empty>
        ) : (
          <ul className="list">
            {exams.slice(0, 4).map((e) => {
              const d = daysBetween(new Date(), eventDayKey(e));
              return (
                <li key={e.id} className="row">
                  <span aria-hidden>{e.kind === 'klausur' ? '📚' : '📝'}</span>
                  <span className="grow">
                    <span className="strong">{KIND_LABEL[e.kind]}</span> {e.subject}
                    <div className="tiny muted">{formatShort(eventDayKey(e))}</div>
                  </span>
                  <span className="pill">{relativeDays(d)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Schlaf" icon="😴" action={<button className="btn ghost" onClick={() => go('gesundheit', 'schlaf')}>Details</button>}>
        {sleep.verdict === 'keine-daten' ? (
          <Empty>{sleep.tips[0]}</Empty>
        ) : (
          <>
            <Status level={sleep.verdict === 'gut' ? 'good' : sleep.verdict === 'ausbaufaehig' ? 'warning' : 'serious'}>{sleep.headline}</Status>
            <div className="stats" style={{ marginTop: 10 }}>
              <Stat label="Letzte Nacht" value={sleep.lastNight ? formatMinutes(sleep.lastNight.minutesAsleep) : '–'} />
              <Stat label="Ø 7 Nächte" value={formatMinutes(sleep.avgAsleepMin)} delta={`Ziel ${settings.sleep.goalHours} h`} />
              {sleep.shouldImprove && <Stat label="Ins Bett um" value={sleep.recommendedBedtime ?? '–'} />}
            </div>
            {sleep.shouldImprove && !learning.active && <p className="small secondary" style={{ marginBottom: 0 }}>{sleep.tips[0]}</p>}
          </>
        )}
      </Card>

      <Card title="Training" icon="🏋️" action={<button className="btn ghost" onClick={() => go('training')}>Öffnen</button>}>
        {training.nextTraining ? (
          <div className="row" style={{ marginBottom: 10 }}>
            <span className="grow">
              <span className="strong">{training.nextTraining.title}</span>
              <div className="tiny muted">
                {formatShort(eventDayKey(training.nextTraining))} · {formatTime(new Date(training.nextTraining.start))} Uhr
              </div>
            </span>
            <button className="btn primary" onClick={() => go('training')}>
              Übungen
            </button>
          </div>
        ) : (
          <p className="small muted" style={{ marginTop: 0 }}>Kein Training in den nächsten 14 Tagen im Kalender.</p>
        )}
        <div className="stats">
          <Stat label="Workouts (7 T.)" value={training.doneLast7} delta={training.plannedLast7 ? `${training.plannedLast7} geplant` : undefined} />
          {lift?.position !== undefined && (
            <Stat
              label="Liftoff-Platz"
              value={`#${lift.position}`}
              delta={training.liftoff.positionChange ? `${signed(training.liftoff.positionChange)} Plätze` : lift.rank}
            />
          )}
          {lift && <Stat label="Errungenschaften" value={`${training.liftoff.unlockedCount}/${training.liftoff.totalAchievements}`} />}
        </div>
      </Card>

      <Card title="Körper & Aktivität" icon="❤️" action={<button className="btn ghost" onClick={() => go('gesundheit', 'aktivitaet')}>Details</button>}>
        {!activity.hasData && !body.latestWeight ? (
          <Empty>Verbinde Fitbit und Withings über Health Connect (Einstellungen).</Empty>
        ) : (
          <div className="stats">
            {activity.hasData && <Stat label="Schritte heute" value={(activity.todaySteps ?? 0).toLocaleString('de-DE')} delta={`Ø ${activity.avgSteps.toLocaleString('de-DE')}`} />}
            {activity.avgRestingHr && <Stat label="Ruhepuls" value={`${activity.avgRestingHr}`} delta="bpm, Ø 7 Tage" />}
            {body.latestWeight && (
              <Stat
                label="Gewicht"
                value={`${body.latestWeight.value.toFixed(1).replace('.', ',')} kg`}
                delta={body.weightChange30 !== undefined ? `${signed(body.weightChange30, 1)} kg / 30 T.` : undefined}
              />
            )}
            {body.latestBp && <Stat label="Blutdruck" value={`${body.latestBp.systolic}/${body.latestBp.diastolic}`} delta={body.bpCategory} />}
          </div>
        )}
      </Card>

      <Card title="Zahnpflege" icon="🪥" action={<button className="btn ghost" onClick={() => go('gesundheit', 'zaehne')}>Details</button>}>
        <div className="stats" style={{ marginBottom: 10 }}>
          <Stat label="Heute" value={`${oral.todayCount}×`} delta="Ziel 2×" />
          {oral.hasData && <Stat label="Ø Dauer" value={`${Math.floor(oral.avgDurationSec / 60)}:${String(Math.round(oral.avgDurationSec % 60)).padStart(2, '0')}`} delta="min" />}
          <Stat label="Serie" value={`${oral.streakDays} T.`} delta="2× täglich" />
        </div>
        <button className="btn block" onClick={logBrushing}>
          Gerade geputzt (2 min)
        </button>
      </Card>
    </>
  );
}
