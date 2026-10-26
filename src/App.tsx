import { App as CapApp } from '@capacitor/app';
import { useEffect, useRef, useState } from 'react';
import { formatLong } from './lib/dates';
import { useStore } from './lib/store';
import { onNotificationTap } from './integrations/notify';
import { ToastHost, toast } from './ui/components';
import { IconCalendar, IconDumbbell, IconGrades, IconHeart, IconHome, IconRefresh, IconSettings } from './ui/icons';
import { NavContext, type Route } from './ui/nav';
import BodyScreen from './ui/screens/BodyScreen';
import CalendarScreen from './ui/screens/CalendarScreen';
import Dashboard from './ui/screens/Dashboard';
import GradesScreen from './ui/screens/GradesScreen';
import HealthScreen from './ui/screens/HealthScreen';
import ReportScreen from './ui/screens/ReportScreen';
import SettingsScreen from './ui/screens/SettingsScreen';
import TrainingScreen from './ui/screens/TrainingScreen';
import WorkoutScreen from './ui/screens/WorkoutScreen';

const TABS: { route: Route; label: string; icon: typeof IconHome }[] = [
  { route: 'start', label: 'Start', icon: IconHome },
  { route: 'kalender', label: 'Kalender', icon: IconCalendar },
  { route: 'noten', label: 'Noten', icon: IconGrades },
  { route: 'training', label: 'Training', icon: IconDumbbell },
  { route: 'gesundheit', label: 'Gesundheit', icon: IconHeart },
  { route: 'einstellungen', label: 'Optionen', icon: IconSettings },
];

const TITLES: Record<Route, string> = {
  start: 'Athlos',
  kalender: 'Kalender & Schule',
  noten: 'Noten',
  training: 'Training',
  gesundheit: 'Gesundheit',
  einstellungen: 'Einstellungen',
  bericht: 'Gesamt-Update',
  workout: 'Training läuft',
  koerper: 'Körperübersicht',
};

/** Sub pages and where the back button leads. */
const PARENT: Partial<Record<Route, Route>> = { bericht: 'start', workout: 'training', koerper: 'training' };

export default function App() {
  const { ready, syncing, syncAll, settings } = useStore();
  const [route, setRoute] = useState<Route>('start');
  const [sub, setSub] = useState<string | undefined>();

  const go = (r: Route, s?: string) => {
    setRoute(r);
    setSub(s);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    onNotificationTap((r) => go(r as Route));
  }, []);

  // Android back button: back to the overview first, then leave the app.
  const routeRef = useRef(route);
  routeRef.current = route;
  useEffect(() => {
    const handle = CapApp.addListener('backButton', () => {
      if (routeRef.current !== 'start') go(PARENT[routeRef.current] ?? 'start');
      else void CapApp.minimizeApp();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);

  const refresh = async () => {
    const res = await syncAll();
    if (res.errors.length) toast(res.errors[0]);
    else if (res.ok.length) toast(`Aktualisiert: ${res.ok.join(' · ')}`);
    else toast(settings.demoMode ? 'Demo-Modus: Beispieldaten werden angezeigt.' : 'Noch nichts verbunden – siehe Einstellungen.');
  };

  if (!ready) return <div className="app" />;

  return (
    <NavContext.Provider value={{ route, go, sub }}>
      <div className="app">
        <header className="topbar">
          {PARENT[route] && (
            <button className="icon-btn" onClick={() => go(PARENT[route]!)} aria-label="Zurück">
              ‹
            </button>
          )}
          <h1>
            {TITLES[route]}
            {route === 'start' && <span className="sub">{formatLong(new Date())}</span>}
          </h1>
          <button className={`icon-btn ${syncing ? 'spin' : ''}`} onClick={refresh} aria-label="Aktualisieren" disabled={syncing}>
            <IconRefresh />
          </button>
        </header>
        <main className="content">
          {route === 'start' && <Dashboard />}
          {route === 'kalender' && <CalendarScreen />}
          {route === 'noten' && <GradesScreen />}
          {route === 'training' && <TrainingScreen />}
          {route === 'gesundheit' && <HealthScreen />}
          {route === 'einstellungen' && <SettingsScreen />}
          {route === 'bericht' && <ReportScreen />}
          {route === 'workout' && <WorkoutScreen />}
          {route === 'koerper' && <BodyScreen />}
        </main>
        <nav className="tabbar">
          {TABS.map((t) => (
            <button key={t.route} className={`tab ${route === t.route || PARENT[route] === t.route ? 'active' : ''}`} onClick={() => go(t.route)}>
              <t.icon />
              {t.label}
            </button>
          ))}
        </nav>
        <ToastHost />
      </div>
    </NavContext.Provider>
  );
}
