import { postsToWorkouts } from '../domain/liftoff';
import type { WorkoutEntry } from '../domain/types';
import { HttpError, httpRequest } from './http';

// Experimental: Liftoff has no official public API. This talks to the same
// tRPC backend the Liftoff app uses, with your own login, to read your own
// workouts. Rangliste & Errungenschaften come from screenshot import instead.

const USER_AGENT = 'Liftoff/528 CFNetwork/3860.400.51 Darwin/25.3.0';

interface TrpcBatch<T> {
  result?: { data?: { json?: T } };
  error?: { json?: { message?: string } };
}

export interface LiftoffTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

function unwrap<T>(body: unknown, action: string): T {
  if (typeof body === 'string' && body.toLowerCase().includes('server is deprecated')) {
    throw new Error(
      `${action}: Liftoff hat diese API-Version abgeschaltet. Trage in den Einstellungen eine neuere Server-Adresse ein (z. B. https://v2-14-0.api.getgymbros.com – passend zur Version deiner Liftoff-App).`,
    );
  }
  const batch = body as TrpcBatch<T>[];
  if (!Array.isArray(batch) || batch.length === 0) throw new Error(`${action}: unerwartete Antwort von Liftoff.`);
  if (batch[0].error) throw new Error(`${action}: ${batch[0].error.json?.message ?? 'Fehler'}`);
  const json = batch[0].result?.data?.json;
  if (json === undefined) throw new Error(`${action}: leere Antwort von Liftoff.`);
  return json;
}

async function call<T>(promise: Promise<unknown>, action: string): Promise<T> {
  let body: unknown;
  try {
    body = await promise;
  } catch (e) {
    if (!(e instanceof HttpError)) throw e;
    if (e.status === 401) throw new Error(`${action}: Anmeldung abgelaufen – bitte neu anmelden.`);
    // tRPC errors (and the deprecation notice) arrive with an error status and a body.
    body = e.body;
  }
  return unwrap<T>(body, action);
}

export async function liftoffLogin(apiBase: string, email: string, password: string): Promise<LiftoffTokens> {
  const json = await call<{ accessToken: string; refreshToken: string; accessTokenExpiresAt: string }>(
    httpRequest({
      url: `${apiBase}/api/trpc/user.signIn?batch=1`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: '*/*', 'User-Agent': USER_AGENT },
      data: { 0: { json: { usernameOrEmail: email, password, provider: 'gymbros' } } },
    }),
    'Liftoff-Anmeldung',
  );
  return { accessToken: json.accessToken, refreshToken: json.refreshToken, expiresAt: json.accessTokenExpiresAt };
}

export async function liftoffRefresh(apiBase: string, refreshToken: string): Promise<LiftoffTokens> {
  const input = encodeURIComponent(JSON.stringify({ 0: { json: refreshToken } }));
  const json = await call<{ accessToken: string; accessTokenExpiresAt: string }>(
    httpRequest({
      url: `${apiBase}/api/trpc/user.refreshToken?batch=1&input=${input}`,
      headers: { Accept: '*/*', 'User-Agent': USER_AGENT },
    }),
    'Liftoff-Token',
  );
  return { accessToken: json.accessToken, refreshToken, expiresAt: json.accessTokenExpiresAt };
}

/** Loads your own logged workouts ("posts"). */
export async function liftoffWorkouts(apiBase: string, refreshToken: string): Promise<WorkoutEntry[]> {
  const tokens = await liftoffRefresh(apiBase, refreshToken);
  const input = encodeURIComponent(JSON.stringify({ 0: { json: null, meta: { values: ['undefined'] } } }));
  const posts = await call<unknown>(
    httpRequest({
      url: `${apiBase}/api/trpc/post.getMyPosts?batch=1&input=${input}`,
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        Accept: '*/*',
        'Accept-Language': 'de-DE,de;q=0.9',
        'User-Agent': USER_AGENT,
      },
    }),
    'Liftoff-Workouts',
  );
  return postsToWorkouts(posts);
}
