import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod';
import { EQUIPMENT, EQUIPMENT_IDS } from '../domain/exercises';
import type { BrushSession, LiftoffSnapshot } from '../domain/types';

// Image understanding (room scan, screenshot import) and the AI summary run
// on Claude with the user's own API key, which never leaves the device except
// for the request to api.anthropic.com.
const MODEL = 'claude-opus-5-5';

export interface ImageInput {
  base64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export class AiError extends Error {}

function client(apiKey: string): Anthropic {
  if (!apiKey.trim()) throw new AiError('Bitte zuerst in den Einstellungen einen Claude-API-Schlüssel eintragen.');
  return new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 120_000 });
}

function imageBlocks(images: ImageInput[]): Anthropic.Beta.BetaImageBlockParam[] {
  return images.map((img) => ({
    type: 'image',
    source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
  }));
}

function friendlyError(e: unknown): Error {
  if (e instanceof AiError) return e;
  if (e instanceof Anthropic.AuthenticationError) return new AiError('Der Claude-API-Schlüssel ist ungültig.');
  if (e instanceof Anthropic.PermissionDeniedError) return new AiError('Der API-Schlüssel hat keinen Zugriff auf dieses Modell.');
  if (e instanceof Anthropic.RateLimitError) return new AiError('Zu viele Anfragen – bitte kurz warten und erneut versuchen.');
  if (e instanceof Anthropic.BadRequestError) return new AiError(`Anfrage abgelehnt: ${e.message}`);
  if (e instanceof Anthropic.APIConnectionError) return new AiError('Keine Verbindung zu Claude – bist du online?');
  if (e instanceof Anthropic.APIError) return new AiError(`Claude-Fehler ${e.status ?? ''}: ${e.message}`);
  return e instanceof Error ? e : new Error(String(e));
}

/** Structured request with the server-side refusal fallback enabled. */
async function parseStructured<T extends z.ZodType>(
  apiKey: string,
  schema: T,
  system: string,
  content: Anthropic.Beta.BetaContentBlockParam[],
  effort: 'low' | 'medium',
): Promise<z.infer<T>> {
  try {
    const res = await client(apiKey).beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages: [{ role: 'user', content }],
      output_config: { effort, format: betaZodOutputFormat(schema) },
    });
    if (res.stop_reason === 'refusal') throw new AiError('Claude konnte dieses Bild nicht auswerten.');
    if (res.stop_reason === 'max_tokens') throw new AiError('Die Antwort war zu lang – bitte weniger Bilder auf einmal senden.');
    if (!res.parsed_output) throw new AiError('Die Antwort konnte nicht gelesen werden – bitte erneut versuchen.');
    return res.parsed_output as z.infer<T>;
  } catch (e) {
    throw friendlyError(e);
  }
}

// ---------- Trainingsraum scannen ----------

const GymScanSchema = z.object({
  equipment: z.array(z.enum(EQUIPMENT_IDS as [string, ...string[]])),
  other_equipment: z.array(z.string()),
  room_description: z.string(),
});

export type GymScanResult = z.infer<typeof GymScanSchema>;

export async function scanGym(apiKey: string, images: ImageInput[]): Promise<GymScanResult> {
  const catalogue = Object.entries(EQUIPMENT)
    .map(([id, label]) => `- ${id}: ${label}`)
    .join('\n');
  return parseStructured(
    apiKey,
    GymScanSchema,
    'Du erkennst Trainingsgeräte auf Fotos von Fitnessräumen. Antworte auf Deutsch.',
    [
      ...imageBlocks(images),
      {
        type: 'text',
        text:
          'Welche Trainingsgeräte sind auf diesen Fotos meines Trainingsraums sichtbar? ' +
          'Ordne jedes sichtbare Gerät einer ID aus diesem Katalog zu:\n' +
          `${catalogue}\n\n` +
          'Regeln: Nur Geräte aufnehmen, die wirklich zu sehen sind. Hantelscheiben ohne Stange zählen als weight_plates. ' +
          'Eine verstellbare Bank zählt als bench und incline_bench. Ein Kabelturm mit Latzug-Stange zählt als cable_machine und lat_pulldown. ' +
          'Geräte, die in keine Kategorie passen, kommen in other_equipment. room_description: ein kurzer Satz zum Raum.',
      },
    ],
    'medium',
  );
}

// ---------- Liftoff-Screenshots ----------

const LiftoffSchema = z.object({
  rank: z.string().nullable(),
  leaderboard_position: z.number().nullable(),
  leaderboard_name: z.string().nullable(),
  leaderboard_size: z.number().nullable(),
  xp: z.number().nullable(),
  level: z.number().nullable(),
  streak_days: z.number().nullable(),
  achievements: z.array(
    z.object({
      name: z.string(),
      unlocked: z.boolean(),
      progress: z.string().nullable(),
    }),
  ),
  leaderboard: z.array(
    z.object({
      position: z.number(),
      name: z.string(),
      score: z.number().nullable(),
      is_me: z.boolean(),
    }),
  ),
  note: z.string(),
});

export async function readLiftoffScreenshots(apiKey: string, images: ImageInput[], username?: string): Promise<LiftoffSnapshot> {
  const r = await parseStructured(
    apiKey,
    LiftoffSchema,
    'Du liest Screenshots der Fitness-App „Liftoff“ aus (Ränge, Ranglisten, Errungenschaften/Achievements, XP, Streaks). Antworte auf Deutsch.',
    [
      ...imageBlocks(images),
      {
        type: 'text',
        text:
          'Lies alle Werte aus diesen Liftoff-Screenshots aus. Felder, die nicht zu sehen sind, sind null. ' +
          'leaderboard: alle sichtbaren Ranglisten-Einträge. ' +
          (username ? `Mein Benutzername ist „${username}“ – markiere diesen Eintrag mit is_me. ` : 'Markiere meinen eigenen Eintrag (hervorgehoben/„Du“/„You“) mit is_me. ') +
          'achievements: alle sichtbaren Errungenschaften mit Status. note: eine kurze Zusammenfassung, was auf den Bildern zu sehen ist.',
      },
    ],
    'low',
  );
  const me = r.leaderboard.find((e) => e.is_me);
  return {
    date: new Date().toISOString(),
    source: 'screenshot',
    rank: r.rank ?? undefined,
    position: r.leaderboard_position ?? me?.position,
    leaderboardName: r.leaderboard_name ?? undefined,
    leaderboardSize: r.leaderboard_size ?? undefined,
    xp: r.xp ?? undefined,
    level: r.level ?? undefined,
    streakDays: r.streak_days ?? undefined,
    achievements: r.achievements.map((a) => ({ name: a.name, unlocked: a.unlocked, progress: a.progress ?? undefined })),
    leaderboard: r.leaderboard.map((e) => ({ position: e.position, name: e.name, score: e.score ?? undefined, isMe: e.is_me })),
    note: r.note,
  };
}

// ---------- Oral-B-Screenshots ----------

const OralBSchema = z.object({
  sessions: z.array(
    z.object({
      date_time: z.string(),
      duration_seconds: z.number(),
      coverage_percent: z.number().nullable(),
      pressure_warnings: z.number().nullable(),
      score: z.number().nullable(),
    }),
  ),
  streak_days: z.number().nullable(),
  note: z.string(),
});

export async function readOralBScreenshots(
  apiKey: string,
  images: ImageInput[],
  now = new Date(),
): Promise<{ sessions: BrushSession[]; streakDays?: number; note: string }> {
  const r = await parseStructured(
    apiKey,
    OralBSchema,
    'Du liest Screenshots der Oral-B-App (iO-Zahnbürste) aus: Putzvorgänge, Dauer, Abdeckung, Druck, Bewertung, Serien. Antworte auf Deutsch.',
    [
      ...imageBlocks(images),
      {
        type: 'text',
        text:
          `Heute ist ${now.toISOString().slice(0, 10)} (Zeitzone Europe/Berlin). ` +
          'Lies jeden sichtbaren Putzvorgang aus. date_time als ISO 8601 mit Uhrzeit in lokaler Zeit ohne Zeitzone (z. B. 2026-10-25T07:12:00); ' +
          'wenn nur „Heute“/„Gestern“/Wochentage stehen, rechne das Datum aus; fehlt die Uhrzeit, nimm 07:00 für morgens und 21:00 für abends. ' +
          'duration_seconds: Putzdauer in Sekunden. coverage_percent: Abdeckung in Prozent. pressure_warnings: Anzahl Druckwarnungen bzw. zu starkes Drücken. ' +
          'score: Putz-Bewertung, falls angezeigt. Nicht sichtbare Werte sind null. note: kurze Zusammenfassung.',
      },
    ],
    'low',
  );
  const sessions: BrushSession[] = r.sessions
    .map((s) => ({
      date: new Date(s.date_time).toISOString(),
      durationSec: Math.round(s.duration_seconds),
      coveragePct: s.coverage_percent ?? undefined,
      pressureWarnings: s.pressure_warnings ?? undefined,
      score: s.score ?? undefined,
      source: 'screenshot' as const,
    }))
    .filter((s) => !Number.isNaN(new Date(s.date).getTime()) && s.durationSec > 0);
  return { sessions, streakDays: r.streak_days ?? undefined, note: r.note };
}

// ---------- KI-Gesamtanalyse ----------

export async function aiOverallSummary(apiKey: string, facts: unknown): Promise<string> {
  try {
    const res = await client(apiKey).beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system:
        'Du bist ein freundlicher Coach für eine Schülerin bzw. einen Schüler (Oberstufe, Brandenburg). ' +
        'Du bekommst ausgewertete Daten aus Kalender, Fitbit, Withings, Liftoff und Oral-B. ' +
        'Schreibe auf Deutsch, per du, in 120–200 Wörtern: eine Gesamteinschätzung, was gut läuft, und genau drei konkrete nächste Schritte. ' +
        'Wenn learning.active true ist (Lernphase vor einer Klausur), gib KEINE Schlaf-Ermahnungen – erwähne Schlaf höchstens als Lernhilfe. ' +
        'Keine medizinischen Diagnosen; bei auffälligem Blutdruck nur sachlich auf ärztlichen Rat hinweisen. Kein Markdown außer kurzen Aufzählungen.',
      messages: [{ role: 'user', content: `Meine Daten (JSON):\n${JSON.stringify(facts)}` }],
    });
    if (res.stop_reason === 'refusal') throw new AiError('Claude konnte keine Zusammenfassung erstellen.');
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!text) throw new AiError('Leere Antwort von Claude.');
    return text;
  } catch (e) {
    throw friendlyError(e);
  }
}
