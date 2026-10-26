import { LocalNotifications } from '@capacitor/local-notifications';
import type { PlannedNotification } from '../domain/notificationPlan';
import { isNative } from './http';

const CHANNELS = [
  { id: 'pruefungen', name: 'Tests & Klausuren', description: 'Erinnerungen vor Tests und Klausuren', importance: 4 as const },
  { id: 'ferien', name: 'Ferien-Countdown', description: 'Alle 2 Wochen: Tage bis zu den nächsten Ferien', importance: 3 as const },
  { id: 'schlaf', name: 'Schlaf', description: 'Abendliche Schlaf-Erinnerung (pausiert in Lernphasen)', importance: 3 as const },
  { id: 'bericht', name: 'Wochen-Update', description: 'Gesamtauswertung deiner Daten', importance: 3 as const },
  { id: 'training', name: 'Pausen-Timer', description: 'Meldet sich, wenn die Satzpause vorbei ist', importance: 4 as const },
];

/** Fixed id of the rest-timer notification – kept when the reminder plan is rebuilt. */
const REST_ID = 7;

let channelsReady = false;

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNative) return false;
  let status = await LocalNotifications.checkPermissions();
  if (status.display !== 'granted') status = await LocalNotifications.requestPermissions();
  return status.display === 'granted';
}

async function ensureChannels(): Promise<void> {
  if (channelsReady) return;
  for (const c of CHANNELS) {
    await LocalNotifications.createChannel({ ...c, visibility: 1, vibration: true });
  }
  channelsReady = true;
}

/** Replaces all pending notifications with the given plan. */
export async function applyNotificationPlan(plan: PlannedNotification[]): Promise<number> {
  if (!isNative) return 0;
  if (!(await ensureNotificationPermission())) return 0;
  await ensureChannels();
  const pending = (await LocalNotifications.getPending()).notifications.filter((n) => n.id !== REST_ID);
  if (pending.length) {
    await LocalNotifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
  }
  // Android caps alarms per app; keep the nearest 120.
  const batch = plan.slice(0, 120);
  if (batch.length) {
    await LocalNotifications.schedule({
      notifications: batch.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        largeBody: n.body,
        channelId: n.channel,
        schedule: { at: n.at, allowWhileIdle: true },
        extra: { route: n.route },
        smallIcon: 'ic_stat_gig',
      })),
    });
  }
  return batch.length;
}

let tapRegistered = false;

export function onNotificationTap(handler: (route: string) => void): void {
  if (!isNative || tapRegistered) return;
  tapRegistered = true;
  void LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const route = (action.notification.extra as { route?: string } | undefined)?.route;
    if (route) handler(route);
  });
}

export async function sendTestNotification(): Promise<boolean> {
  if (!(await ensureNotificationPermission())) return false;
  await ensureChannels();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 1,
        title: '✅ Benachrichtigungen funktionieren',
        body: 'So sehen deine Erinnerungen von Athlos aus.',
        channelId: 'bericht',
        schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true },
        smallIcon: 'ic_stat_gig',
      },
    ],
  });
  return true;
}

/** Notification when the rest between sets is over (also with the screen off). */
export async function scheduleRestEnd(seconds: number, next: string): Promise<void> {
  if (!isNative || seconds <= 0) return;
  const status = await LocalNotifications.checkPermissions();
  if (status.display !== 'granted') return;
  await ensureChannels();
  await LocalNotifications.cancel({ notifications: [{ id: REST_ID }] });
  await LocalNotifications.schedule({
    notifications: [
      {
        id: REST_ID,
        title: '⏱️ Pause vorbei',
        body: `Weiter geht's: ${next}`,
        channelId: 'training',
        schedule: { at: new Date(Date.now() + seconds * 1000), allowWhileIdle: true },
        smallIcon: 'ic_stat_gig',
        extra: { route: 'workout' },
      },
    ],
  });
}

export async function cancelRestEnd(): Promise<void> {
  if (!isNative) return;
  await LocalNotifications.cancel({ notifications: [{ id: REST_ID }] });
}
