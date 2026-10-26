import { App as CapApp } from '@capacitor/app';
import { useEffect, useRef, useState } from 'react';
import { formatLong } from './lib/dates';
import { useStore } from './lib/store';
import { onNotificationTap } from './integrations/notify';
import { ToastHost, toast } from './ui/components';
import { IconCalendar, IconDumbbell, IconHeart, IconHome, IconRefresh, IconSettings } from './ui/icons';
import { NavContext, type Route } from './ui/nav';
import CalendarScreen from './ui/screens/CalendarScreen';
import Dashboard from './ui/screens/Dashboard';
import HealthScreen from './ui/screens/HealthScreen';
import ReportScreen from './ui/screens/ReportScreen';
import SettingsScreen from './ui/screens/SettingsScreen';
import TrainingScreen from './ui/screens/TrainingScreen';

const TABS: { route: Route; label: string; icon: typeof IconHome }[] = [
  { route: 'start', label: 'Übersicht', icon: IconHome },
  { route: 'kalender', label: 'Kalender', icon: IconCalendar },
  { route: 'training', label: 'Training', icon: IconDumbbell },
  { route: 'gesundheit', label: 'Gesundheit', icon: IconHeart },
  { route: 'einstellungen', label: 'Einstellungen', icon: IconSettings },
];

const TITLES: Record<Route, string> = {
  start: 'Gig Fit',
  kalender: 'Kalender & Schule',
  training: 'Training',
  gesundheit: 'Gesundheit',
  einstellungen: 'Einstellungen',
  bericht: 'Gesamt-Update',
};

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
      if (routeRef.current !== 'start') go('start');
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
          {route === 'bericht' && (
            <button className="icon-btn" onClick={() => go('start')} aria-label="Zurück">
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
          {route === 'training' && <TrainingScreen />}
          {route === 'gesundheit' && <HealthScreen />}
          {route === 'einstellungen' && <SettingsScreen />}
          {route === 'bericht' && <ReportScreen />}
        </main>
        <nav className="tabbar">
          {TABS.map((t) => (
            <button key={t.route} className={`tab ${route === t.route || (t.route === 'start' && route === 'bericht') ? 'active' : ''}`} onClick={() => go(t.route)}>
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
