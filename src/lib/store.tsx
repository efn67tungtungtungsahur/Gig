import { App as CapApp } from '@capacitor/app';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { emptyData, mergeData, mergeSettings } from '../domain/defaults';
import { isRealFerien } from '../domain/holidays';
import { buildNotificationPlan } from '../domain/notificationPlan';
import { buildReport, type OverallReport } from '../domain/report';
import type { AppData, HolidayPeriod, Settings } from '../domain/types';
import { syncCalendars } from '../integrations/calendarSync';
import { demoData } from '../integrations/demo';
import { syncHealth } from '../integrations/health';
import { mergeActivity } from '../domain/badges';
import { mainNights } from '../domain/sleep';
import { fetchBrandenburgHolidays } from '../integrations/holidaysApi';
import { liftoffWorkouts } from '../integrations/liftoffApi';
import { applyNotificationPlan } from '../integrations/notify';
import { loadJson, saveJson } from './storage';

const SETTINGS_KEY = 'gig.settings';
const DATA_KEY = 'gig.data';
const AUTO_SYNC_MIN = 30;

export interface SyncResult {
  ok: string[];
  errors: string[];
  scheduled?: number;
}

interface StoreValue {
  ready: boolean;
  settings: Settings;
  /** Real data, or demo data while demo mode is on. */
  data: AppData;
  realData: AppData;
  report: OverallReport;
  syncing: boolean;
  lastSync?: SyncResult;
  updateSettings: (fn: (s: Settings) => Settings) => Promise<Settings>;
  updateData: (fn: (d: AppData) => AppData) => Promise<AppData>;
  syncAll: (opts?: { silent?: boolean }) => Promise<SyncResult>;
}

const StoreContext = createContext<StoreValue | null>(null);

/** Online periods win; bundled ones fill gaps the API doesn't cover. */
function mergeHolidays(online: HolidayPeriod[], bundled: HolidayPeriod[]): HolidayPeriod[] {
  const out = [...online];
  for (const b of bundled) {
    if (!online.some((o) => o.start <= b.end && b.start <= o.end)) out.push(b);
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => mergeSettings(null));
  const [realData, setRealData] = useState<AppData>(() => emptyData());
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<SyncResult>();
  const settingsRef = useRef(settings);
  const dataRef = useRef(realData);
  const syncingRef = useRef(false);

  useEffect(() => {
    void (async () => {
      const [s, d] = await Promise.all([loadJson<Settings>(SETTINGS_KEY), loadJson<AppData>(DATA_KEY)]);
      const merged = mergeSettings(s);
      settingsRef.current = merged;
      dataRef.current = mergeData(d);
      setSettings(merged);
      setRealData(dataRef.current);
      setReady(true);
    })();
  }, []);

  const updateSettings = useCallback(async (fn: (s: Settings) => Settings) => {
    const next = fn(settingsRef.current);
    settingsRef.current = next;
    setSettings(next);
    await saveJson(SETTINGS_KEY, next);
    return next;
  }, []);

  const updateData = useCallback(async (fn: (d: AppData) => AppData) => {
    const next = fn(dataRef.current);
    dataRef.current = next;
    setRealData(next);
    await saveJson(DATA_KEY, next);
    return next;
  }, []);

  const syncAll = useCallback(
    async (opts?: { silent?: boolean }): Promise<SyncResult> => {
      if (syncingRef.current) return { ok: [], errors: ['Synchronisierung läuft bereits'] };
      syncingRef.current = true;
      if (!opts?.silent) setSyncing(true);
      const s = settingsRef.current;
      const result: SyncResult = { ok: [], errors: [] };
      const now = new Date();
      let next: AppData = { ...dataRef.current };
      try {
        const tasks: Promise<void>[] = [];
        if (s.icsUrls.some((u) => u.trim())) {
          tasks.push(
            syncCalendars(s.icsUrls, now).then((cal) => {
              // Keep old events if every feed failed (e.g. offline).
              if (cal.events.length || !cal.errors.length) next = { ...next, calendar: cal };
              else next = { ...next, calendar: { ...next.calendar, errors: cal.errors } };
              if (cal.errors.length) result.errors.push(...cal.errors);
              else result.ok.push(`Kalender: ${cal.events.length} Termine`);
            }),
          );
        }
        if (s.healthConnected) {
          tasks.push(
            syncHealth(now, s.sleep.source)
              .then((health) => {
                next = { ...next, health, activity: mergeActivity(next.activity, health) };
                result.ok.push(`Health Connect: ${health.sleep.length} Nächte, ${health.steps.length} Tage`);
                if (health.error) result.errors.push(health.error);
              })
              .catch((e) => {
                result.errors.push(`Health Connect: ${(e as Error).message}`);
              }),
          );
        }
        if (s.liftoff.refreshToken) {
          tasks.push(
            liftoffWorkouts(s.liftoff.apiBase, s.liftoff.refreshToken)
              .then((workouts) => {
                next = { ...next, liftoff: { ...next.liftoff, workouts, syncedAt: now.toISOString(), error: undefined } };
                result.ok.push(`Liftoff: ${workouts.length} Workouts`);
              })
              .catch((e) => {
                next = { ...next, liftoff: { ...next.liftoff, error: (e as Error).message } };
                result.errors.push((e as Error).message);
              }),
          );
        }
        const holidaysAge = next.holidays.updatedAt ? now.getTime() - new Date(next.holidays.updatedAt).getTime() : Infinity;
        if (holidaysAge > 7 * 86_400_000) {
          tasks.push(
            fetchBrandenburgHolidays(now)
              .then((h) => {
                if (h && h.periods.some(isRealFerien)) {
                  next = { ...next, holidays: { ...h, periods: mergeHolidays(h.periods, emptyData().holidays.periods) } };
                  result.ok.push('Ferientermine aktualisiert');
                }
              })
              .catch(() => {
                /* offline – bundled dates stay */
              }),
          );
        }
        await Promise.all(tasks);
        await updateData(() => next);

        if (!s.demoMode) {
          const report = buildReport(next, s, now);
          const plan = buildNotificationPlan(next, s, report, now);
          try {
            result.scheduled = await applyNotificationPlan(plan);
          } catch (e) {
            result.errors.push(`Benachrichtigungen: ${(e as Error).message}`);
          }
        }
      } finally {
        syncingRef.current = false;
        setSyncing(false);
        setLastSync(result);
      }
      return result;
    },
    [updateData],
  );

  // Sync on start and whenever the app comes back to the foreground.
  useEffect(() => {
    if (!ready) return;
    const maybeSync = () => {
      const last = dataRef.current.calendar.syncedAt ?? dataRef.current.health.syncedAt;
      if (!last || Date.now() - new Date(last).getTime() > AUTO_SYNC_MIN * 60_000) void syncAll({ silent: true });
    };
    maybeSync();
    const handle = CapApp.addListener('resume', maybeSync);
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [ready, syncAll]);

  const data = useMemo(() => {
    const d = settings.demoMode ? demoData() : realData;
    // The preferred sleep source applies immediately, without a new sync.
    const sessions = d.health.sleepSessions;
    return sessions?.length ? { ...d, health: { ...d.health, sleep: mainNights(sessions, settings.sleep.source) } } : d;
  }, [settings.demoMode, settings.sleep.source, realData]);
  const report = useMemo(() => buildReport(data, settings), [data, settings]);

  const value: StoreValue = { ready, settings, data, realData, report, syncing, lastSync, updateSettings, updateData, syncAll };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore outside provider');
  return v;
}
