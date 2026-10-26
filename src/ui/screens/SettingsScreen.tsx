import { useEffect, useState } from 'react';
import { defaultSettings, emptyData } from '../../domain/defaults';
import type { Settings, TrainingGoal } from '../../domain/types';
import { formatDate, WEEKDAYS_LONG } from '../../lib/dates';
import { useStore } from '../../lib/store';
import { importIcsText } from '../../integrations/calendarSync';
import { pickTextFile } from '../../integrations/camera';
import { healthAvailability, openHealthConnect, requestHealthPermissions } from '../../integrations/health';
import { isNative } from '../../integrations/http';
import { liftoffLogin } from '../../integrations/liftoffApi';
import { sendTestNotification } from '../../integrations/notify';
import { isVisionModelCached, preloadVisionModel } from '../../integrations/vision';
import type { VisionProgress } from '../../integrations/visionEngine';
import { Card, Segmented, Switch, toast, useAction } from '../components';

function parseOffsets(text: string): number[] {
  return [...new Set(text.split(/[,;\s]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 60))].sort((a, b) => b - a);
}

function parseWords(text: string): string[] {
  return text
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);
}

export default function SettingsScreen() {
  const { settings, updateSettings, updateData, realData, syncAll } = useStore();
  const { busy, run } = useAction();
  const [newUrl, setNewUrl] = useState('');
  const [hcState, setHcState] = useState<{ available: boolean; reason?: string } | null>(null);
  const [liftEmail, setLiftEmail] = useState(settings.liftoff.email);
  const [liftPassword, setLiftPassword] = useState('');
  const [modelCached, setModelCached] = useState<boolean | null>(null);
  const [modelProgress, setModelProgress] = useState<VisionProgress | null>(null);

  useEffect(() => {
    void healthAvailability().then(setHcState);
    void isVisionModelCached().then(setModelCached);
  }, []);

  const set = (fn: (s: Settings) => Settings) => void updateSettings(fn);

  const addUrl = () =>
    run('ics', async () => {
      const url = newUrl.trim();
      if (!/^(https?|webcal):\/\//.test(url)) throw new Error('Bitte eine vollständige Adresse (https://…/basic.ics) einfügen.');
      await updateSettings((s) => ({ ...s, icsUrls: [...s.icsUrls, url], welcomeDone: true, demoMode: false }));
      setNewUrl('');
      const res = await syncAll();
      toast(res.errors.length ? res.errors[0] : `Kalender verbunden: ${res.ok.join(' · ')}`);
    });

  const importIcs = () =>
    run('icsfile', async () => {
      const text = await pickTextFile('.ics,text/calendar');
      if (!text) return;
      const events = importIcsText(text);
      await updateData((d) => {
        const map = new Map([...d.calendar.events, ...events].map((e) => [e.id, e]));
        return { ...d, calendar: { ...d.calendar, events: [...map.values()].sort((a, b) => a.start.localeCompare(b.start)) } };
      });
      toast(`${events.length} Termine importiert.`);
    });

  const connectHealth = () =>
    run('health', async () => {
      const res = await requestHealthPermissions();
      if (!res.granted.length) throw new Error('Keine Berechtigung erteilt. Du kannst sie in Health Connect jederzeit nachholen.');
      await updateSettings((s) => ({ ...s, healthConnected: true, welcomeDone: true, demoMode: false }));
      const sync = await syncAll();
      toast(sync.errors.length ? sync.errors[0] : `Health Connect verbunden (${res.granted.length} Datentypen).`);
    });

  const loginLiftoff = () =>
    run('liftoff', async () => {
      if (!liftEmail.trim() || !liftPassword) throw new Error('Bitte E-Mail/Benutzername und Passwort eingeben.');
      const tokens = await liftoffLogin(settings.liftoff.apiBase, liftEmail.trim(), liftPassword);
      await updateSettings((s) => ({ ...s, liftoff: { ...s.liftoff, email: liftEmail.trim(), refreshToken: tokens.refreshToken }, welcomeDone: true, demoMode: false }));
      setLiftPassword('');
      const sync = await syncAll();
      toast(sync.errors.find((e) => e.includes('Liftoff')) ?? 'Liftoff verbunden.');
    });

  const loadModel = () =>
    run('model', async () => {
      setModelProgress({ phase: 'laden', percent: 0 });
      try {
        await preloadVisionModel(setModelProgress);
        setModelCached(true);
        toast('Erkennungsmodell geladen – der Raum-Scan funktioniert jetzt auch offline.');
      } finally {
        setModelProgress(null);
      }
    });

  const resetAll = () =>
    run('reset', async () => {
      if (!window.confirm('Wirklich alle Daten und Einstellungen löschen?')) return;
      await updateData(() => emptyData());
      await updateSettings(() => defaultSettings());
      toast('Alles zurückgesetzt.');
    });

  return (
    <>
      <div className="section-title">Verbindungen</div>

      <Card title="Google Kalender" icon="📅">
        <p className="small secondary" style={{ marginTop: 0 }}>
          Öffne Google Kalender im Browser → ⚙️ Einstellungen → links deinen Kalender wählen → „Kalender integrieren“ → <strong>„Geheime Adresse im
          iCal-Format“</strong> kopieren und hier einfügen. Für mehrere Kalender (z. B. Schule + privat) einfach mehrere Adressen hinzufügen.
        </p>
        {settings.icsUrls.map((u, i) => (
          <div key={u} className="row small" style={{ marginBottom: 6 }}>
            <span className="grow muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {i + 1}. {u.replace(/private-[^/]+/, 'private-••••')}
            </span>
            <button className="btn ghost danger" onClick={() => set((s) => ({ ...s, icsUrls: s.icsUrls.filter((x) => x !== u) }))}>
              Entfernen
            </button>
          </div>
        ))}
        <label className="field">
          <span>iCal-Adresse</span>
          <input className="input" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" />
        </label>
        <div className="row wrap">
          <button className="btn primary grow" onClick={addUrl} disabled={busy !== null || !newUrl.trim()}>
            {busy === 'ics' ? 'Verbinde …' : 'Kalender hinzufügen'}
          </button>
          <button className="btn grow" onClick={importIcs} disabled={busy !== null}>
            .ics-Datei importieren
          </button>
        </div>
        {realData.calendar.syncedAt && (
          <p className="tiny muted" style={{ marginBottom: 0 }}>
            Zuletzt synchronisiert: {formatDate(new Date(realData.calendar.syncedAt))} · {realData.calendar.events.length} Termine
          </p>
        )}
      </Card>

      <Card title="Fitbit & Withings (Health Connect)" icon="❤️">
        <p className="small secondary" style={{ marginTop: 0 }}>
          Google schaltet die Fitbit-Web-API am 30.10.2026 ab. Gig Fit liest deshalb über <strong>Health Connect</strong> – das geht ohne
          Entwickler-Konto:
        </p>
        <ol className="bullets small secondary">
          <li>Fitbit-App → Profil → Einstellungen → „Health Connect“ → Synchronisierung aktivieren.</li>
          <li>Withings-App (Health Mate) → Profil → „Apps &amp; Geräte verbinden“ → „Health Connect“ aktivieren.</li>
          <li>Hier auf „Verbinden“ tippen und alle Lese-Berechtigungen erlauben.</li>
        </ol>
        {hcState && !hcState.available && (
          <div className="banner warn small" style={{ marginBottom: 10 }}>
            {isNative ? `Health Connect nicht verfügbar${hcState.reason ? ` (${hcState.reason})` : ''}. Installiere „Health Connect“ aus dem Play Store (ab Android 14 vorinstalliert).` : hcState.reason}
          </div>
        )}
        <div className="row wrap">
          <button className="btn primary grow" onClick={connectHealth} disabled={busy !== null || !hcState?.available}>
            {busy === 'health' ? 'Verbinde …' : settings.healthConnected ? 'Berechtigungen erneut prüfen' : 'Verbinden'}
          </button>
          {hcState?.available && (
            <button className="btn grow" onClick={() => void openHealthConnect()}>
              Health Connect öffnen
            </button>
          )}
        </div>
        {settings.healthConnected && (
          <p className="tiny muted" style={{ marginBottom: 0 }}>
            Verbunden{realData.health.sources.length ? ` · Quellen: ${realData.health.sources.join(', ')}` : ''}
            {realData.health.syncedAt ? ` · zuletzt ${formatDate(new Date(realData.health.syncedAt))}` : ''}
          </p>
        )}
      </Card>

      <Card title="Liftoff" icon="🚀">
        <p className="small secondary" style={{ marginTop: 0 }}>
          <strong>Rangliste &amp; Errungenschaften:</strong> per Screenshot-Import im Tab „Training“. <strong>Workouts:</strong> optional über
          deinen Liftoff-Login (experimentell – Liftoff hat keine offizielle Schnittstelle; funktioniert nur mit E-Mail/Passwort, nicht mit
          „Mit Google anmelden“).
        </p>
        {settings.liftoff.refreshToken ? (
          <div className="row">
            <span className="grow small">Angemeldet als {settings.liftoff.email}</span>
            <button className="btn ghost danger" onClick={() => set((s) => ({ ...s, liftoff: { ...s.liftoff, refreshToken: '' } }))}>
              Abmelden
            </button>
          </div>
        ) : (
          <>
            <label className="field">
              <span>E-Mail oder Benutzername</span>
              <input className="input" autoComplete="username" value={liftEmail} onChange={(e) => setLiftEmail(e.target.value)} />
            </label>
            <label className="field">
              <span>Passwort (wird nicht gespeichert)</span>
              <input className="input" type="password" autoComplete="current-password" value={liftPassword} onChange={(e) => setLiftPassword(e.target.value)} />
            </label>
            <button className="btn primary block" onClick={loginLiftoff} disabled={busy !== null}>
              {busy === 'liftoff' ? 'Melde an …' : 'Bei Liftoff anmelden'}
            </button>
          </>
        )}
        <details style={{ marginTop: 10 }}>
          <summary className="small muted">Erweitert: Server-Adresse</summary>
          <label className="field" style={{ marginTop: 8 }}>
            <span>Liftoff-API (bei „API-Version abgeschaltet“ an deine App-Version anpassen)</span>
            <input className="input" value={settings.liftoff.apiBase} onChange={(e) => set((s) => ({ ...s, liftoff: { ...s.liftoff, apiBase: e.target.value.trim().replace(/\/$/, '') } }))} />
          </label>
        </details>
      </Card>

      <Card title="Oral-B iO" icon="🪥">
        <p className="small secondary" style={{ margin: 0 }}>
          Oral-B hat keine offene Schnittstelle. Importiere Screenshots aus der Oral-B-App (Gesundheit → Zähne) – die Texterkennung läuft auf dem
          Handy – oder trage Putzvorgänge ein. Gig Fit wertet Häufigkeit, Dauer, Abdeckung und Druck aus.
        </p>
      </Card>

      <Card title="Bilderkennung (kostenlos)" icon="📷">
        <p className="small secondary" style={{ marginTop: 0 }}>
          Raum-Scan und Screenshot-Import laufen direkt auf deinem Handy – ohne Konto, ohne Kosten. Für den Raum-Scan wird einmalig ein offenes
          Erkennungsmodell (MobileCLIP) von Hugging Face geladen, danach funktioniert er offline. Die Texterkennung (Google ML Kit) ist schon in der App
          enthalten.
        </p>
        {modelProgress ? (
          <div className="banner info small">
            Lade Modell … {modelProgress.percent} %
          </div>
        ) : modelCached ? (
          <p className="small">✓ Erkennungsmodell ist auf dem Handy.</p>
        ) : (
          <button className="btn block" onClick={loadModel} disabled={busy !== null}>
            Modell jetzt laden (WLAN empfohlen)
          </button>
        )}
      </Card>

      <div className="section-title">Erinnerungen</div>

      <Card title="Tests & Klausuren" icon="📚">
        <Switch checked={settings.reminders.enabled} onChange={(v) => set((s) => ({ ...s, reminders: { ...s.reminders, enabled: v } }))} label="Erinnerungen senden" />
        <OffsetField
          label="Test: Tage vorher"
          value={settings.reminders.testOffsets}
          onChange={(v) => set((s) => ({ ...s, reminders: { ...s.reminders, testOffsets: v } }))}
        />
        <OffsetField
          label="Klausur: Tage vorher"
          value={settings.reminders.klausurOffsets}
          onChange={(v) => set((s) => ({ ...s, reminders: { ...s.reminders, klausurOffsets: v } }))}
        />
        <label className="field">
          <span>Uhrzeit</span>
          <input className="input" type="time" value={settings.reminders.time} onChange={(e) => set((s) => ({ ...s, reminders: { ...s.reminders, time: e.target.value || '17:00' } }))} />
        </label>
        <WordsField label="Stichwörter Klausur" value={settings.keywords.klausur} onChange={(v) => set((s) => ({ ...s, keywords: { ...s.keywords, klausur: v } }))} />
        <WordsField label="Stichwörter Test" value={settings.keywords.test} onChange={(v) => set((s) => ({ ...s, keywords: { ...s.keywords, test: v } }))} />
      </Card>

      <Card title="Schlaf" icon="😴">
        <Switch
          checked={settings.sleep.remindersEnabled}
          onChange={(v) => set((s) => ({ ...s, sleep: { ...s.sleep, remindersEnabled: v } }))}
          label="Schlaf-Erinnerung"
          hint="Nur wenn dein Schlaf besser werden sollte – und nie in der Lernphase vor einer Klausur."
        />
        <label className="field">
          <span>Schlafziel: {settings.sleep.goalHours.toLocaleString('de-DE')} Stunden</span>
          <input type="range" min={6} max={10} step={0.5} value={settings.sleep.goalHours} style={{ width: '100%' }} onChange={(e) => set((s) => ({ ...s, sleep: { ...s.sleep, goalHours: Number(e.target.value) } }))} />
        </label>
        <label className="field">
          <span>Lernphase: {settings.sleep.learningPhaseDays} Tage vor einer Klausur keine Schlaf-Erinnerungen</span>
          <input type="range" min={1} max={14} step={1} value={settings.sleep.learningPhaseDays} style={{ width: '100%' }} onChange={(e) => set((s) => ({ ...s, sleep: { ...s.sleep, learningPhaseDays: Number(e.target.value) } }))} />
        </label>
        <Switch checked={settings.sleep.pauseForTests} onChange={(v) => set((s) => ({ ...s, sleep: { ...s.sleep, pauseForTests: v } }))} label="Auch vor Tests pausieren" />
        <WordsField label="Stichwörter Lernzeit (pausiert ebenfalls)" value={settings.keywords.lernen} onChange={(v) => set((s) => ({ ...s, keywords: { ...s.keywords, lernen: v } }))} />
      </Card>

      <Card title="Ferien & Wochen-Update" icon="🏖️">
        <Switch
          checked={settings.holidays.biweeklyEnabled}
          onChange={(v) => set((s) => ({ ...s, holidays: { ...s.holidays, biweeklyEnabled: v } }))}
          label="Alle 2 Wochen: Tage bis zu den Ferien"
        />
        <label className="field">
          <span>Uhrzeit Ferien-Update</span>
          <input className="input" type="time" value={settings.holidays.time} onChange={(e) => set((s) => ({ ...s, holidays: { ...s.holidays, time: e.target.value || '08:00' } }))} />
        </label>
        <Switch checked={settings.weeklyReport.enabled} onChange={(v) => set((s) => ({ ...s, weeklyReport: { ...s.weeklyReport, enabled: v } }))} label="Wöchentliches Gesamt-Update" />
        <div className="row">
          <label className="field grow">
            <span>Tag</span>
            <select className="input" value={settings.weeklyReport.weekday} onChange={(e) => set((s) => ({ ...s, weeklyReport: { ...s.weeklyReport, weekday: Number(e.target.value) } }))}>
              {WEEKDAYS_LONG.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="field grow">
            <span>Uhrzeit</span>
            <input className="input" type="time" value={settings.weeklyReport.time} onChange={(e) => set((s) => ({ ...s, weeklyReport: { ...s.weeklyReport, time: e.target.value || '18:00' } }))} />
          </label>
        </div>
      </Card>

      <div className="section-title">Training</div>
      <Card>
        <div className="field">
          <span className="small secondary" style={{ display: 'block', marginBottom: 6 }}>
            Trainingsziel
          </span>
          <Segmented<TrainingGoal>
            value={settings.training.goal}
            onChange={(v) => set((s) => ({ ...s, training: { ...s.training, goal: v } }))}
            options={[
              { value: 'muskelaufbau', label: 'Muskeln' },
              { value: 'kraft', label: 'Kraft' },
              { value: 'ausdauer', label: 'Ausdauer' },
              { value: 'fitness', label: 'Fitness' },
            ]}
          />
        </div>
        <label className="field">
          <span>Schrittziel pro Tag</span>
          <input
            className="input"
            inputMode="numeric"
            value={settings.training.stepsGoal}
            onChange={(e) => set((s) => ({ ...s, training: { ...s.training, stepsGoal: Math.max(1000, Number(e.target.value) || 10000) } }))}
          />
        </label>
        <WordsField label="Stichwörter Training" value={settings.keywords.training} onChange={(v) => set((s) => ({ ...s, keywords: { ...s.keywords, training: v } }))} />
      </Card>

      <div className="section-title">App</div>
      <Card>
        <Switch checked={settings.demoMode} onChange={(v) => set((s) => ({ ...s, demoMode: v, welcomeDone: true }))} label="Demo-Modus" hint="Zeigt Beispieldaten; es werden keine Erinnerungen geplant." />
        <div className="stack" style={{ marginTop: 8 }}>
          <button
            className="btn block"
            onClick={() =>
              run('sync', async () => {
                const r = await syncAll();
                toast(r.errors.length ? r.errors[0] : `Fertig${r.scheduled !== undefined ? ` · ${r.scheduled} Erinnerungen geplant` : ''}`);
              })
            }
            disabled={busy !== null}
          >
            Jetzt synchronisieren & Erinnerungen planen
          </button>
          <button
            className="btn block"
            onClick={() =>
              run('test', async () => {
                toast((await sendTestNotification()) ? 'Die Test-Benachrichtigung kommt in 3 Sekunden.' : 'Benachrichtigungen sind nicht erlaubt (oder du bist nicht in der Android-App).');
              })
            }
            disabled={busy !== null}
          >
            Test-Benachrichtigung senden
          </button>
          <button className="btn block danger" onClick={resetAll} disabled={busy !== null}>
            Alle Daten löschen
          </button>
        </div>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          Alle Daten bleiben auf deinem Handy. Gig Fit hat keinen eigenen Server. Version {__APP_VERSION__}.
        </p>
      </Card>
    </>
  );
}

function OffsetField({ label, value, onChange }: { label: string; value: number[]; onChange: (v: number[]) => void }) {
  const [text, setText] = useState(value.join(', '));
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const parsed = parseOffsets(text);
          if (parsed.length) onChange(parsed);
          setText((parsed.length ? parsed : value).join(', '));
        }}
      />
    </label>
  );
}

function WordsField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join(', '));
  return (
    <label className="field">
      <span>{label} (mit Komma getrennt)</span>
      <input
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const words = parseWords(text);
          if (words.length) onChange(words);
          setText((words.length ? words : value).join(', '));
        }}
      />
    </label>
  );
}
