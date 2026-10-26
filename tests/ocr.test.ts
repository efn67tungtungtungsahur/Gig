import { describe, expect, it } from 'vitest';
import { linesToRows, parseDay, parseDuration, parseLiftoffText, parseOralBText } from '../src/domain/ocrParse';
import { dayKey } from '../src/lib/dates';

describe('OCR rows', () => {
  it('joins columns that ML Kit returns as separate blocks into rows', () => {
    const rows = linesToRows([
      { text: '2.310 XP', x: 300, y: 100, w: 80, h: 20 },
      { text: '7', x: 10, y: 102, w: 10, h: 20 },
      { text: 'Lena', x: 60, y: 98, w: 60, h: 22 },
      { text: '8', x: 10, y: 140, w: 10, h: 20 },
      { text: 'Jonas', x: 60, y: 141, w: 60, h: 20 },
      { text: '2.280 XP', x: 300, y: 139, w: 80, h: 20 },
    ]);
    expect(rows).toEqual(['7  Lena  2.310 XP', '8  Jonas  2.280 XP']);
  });
});

describe('Liftoff screenshots', () => {
  it('reads rank, position, XP, level, streak and the leaderboard', () => {
    const d = parseLiftoffText([
      'Leaderboard',
      'Friends · Weekly',
      'Gold III',
      '7  Lena  2,310 XP',
      '8  Jonas  2,280 XP',
      '9  You  2,195 XP',
      '10  Mia  2,050 XP',
      'Level 25',
      '13,420 XP',
      '17 day streak',
    ]);
    expect(d).toMatchObject({ rank: 'Gold III', position: 9, xp: 13420, level: 25, streakDays: 17 });
    expect(d.leaderboard).toHaveLength(4);
    expect(d.leaderboard.find((e) => e.isMe)?.name).toBe('You');
    expect(d.achievements.map((a) => a.name)).not.toContain('Friends · Weekly');
  });

  it('collects achievements with progress and lock state', () => {
    const d = parseLiftoffText(['Errungenschaften', 'Erstes Workout', 'Frühaufsteher', '30-Tage-Serie  17/30', 'Lift 10.000 kg', '🔒 50 Workouts']);
    const names = d.achievements.map((a) => a.name);
    expect(names).toEqual(['Erstes Workout', 'Frühaufsteher', '30-Tage-Serie', 'Lift 10.000 kg', '50 Workouts']);
    expect(d.achievements.every((a) => a.preselected)).toBe(true);
    expect(d.achievements.find((a) => a.name === '30-Tage-Serie')).toMatchObject({ unlocked: false, progress: '17/30' });
    expect(d.achievements.find((a) => a.name === '50 Workouts')?.unlocked).toBe(false);
    expect(d.streakDays).toBeUndefined();
  });

  it('uses the username to find your own row', () => {
    const d = parseLiftoffText(['12  maxpower  980', '13  Ferdi_99  950', '14  Tom  900'], 'ferdi_99');
    expect(d.position).toBe(13);
  });
});

describe('Oral-B screenshots', () => {
  const now = new Date(2026, 9, 26, 22, 0); // Monday

  it('parses days, durations and clock times', () => {
    expect(dayKey(parseDay('Gestern', now)!)).toBe('2026-10-25');
    expect(dayKey(parseDay('Mo., 19. Okt.', now)!)).toBe('2026-10-19');
    expect(dayKey(parseDay('Do', now)!)).toBe('2026-10-22');
    expect(dayKey(parseDay('28.12.', now)!)).toBe('2025-12-28');
    expect(parseDuration('2:05 min')).toBe(125);
    expect(parseDuration('2 Min. 15 Sek.')).toBe(135);
    expect(parseDuration('118 s')).toBe(118);
  });

  it('turns a brushing history into sessions', () => {
    const s = parseOralBText(
      ['Putzverlauf', 'Heute', '07:12 Uhr  2:05 min  96 %', '21:40 Uhr  1:48 min  88 %', 'Gestern', '07:05  2:10  92%', 'Druck: 1x zu fest', 'Mo., 19. Okt.', '2 Min. 15 Sek.'],
      now,
    );
    expect(s).toHaveLength(4);
    expect(s.map((x) => x.durationSec)).toEqual([125, 108, 130, 135]);
    const first = new Date(s[0].date);
    expect([dayKey(first), first.getHours(), first.getMinutes()]).toEqual(['2026-10-26', 7, 12]);
    expect(s[0].coveragePct).toBe(96);
    expect(dayKey(new Date(s[2].date))).toBe('2026-10-25');
    expect(s[2].pressureWarnings).toBe(1);
    expect(dayKey(new Date(s[3].date))).toBe('2026-10-19');
    expect(new Date(s[3].date).getHours()).toBe(7);
  });
});

