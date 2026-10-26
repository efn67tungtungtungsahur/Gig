import { useEffect, useId, useRef, type ReactElement } from 'react';
import { RANK_NAMES } from '../domain/body';
import type { MuscleGroup } from '../domain/types';

// Cartoon body, front and back (centre x = 110): light skin, muscles
// separated by thin skin-coloured gaps, open hands. Muscles describe the left
// half and are mirrored.

const CX = 110;
const VIEW_W = CX * 2;

type Seg = [number, number, number, number, number, number];

// The raw drawing below is long-limbed; torso, arms and (a little) legs are
// compressed vertically when the paths are built. Head and hands keep their size.
const TORSO_TOP = 78;
const CROTCH = 242;
const TORSO_SCALE = 0.8;
const LEG_SCALE = 0.9;
const SHOULDER_Y = 92;
const WRIST_Y = 236;
const ARM_SCALE = 0.66;

function torsoY(y: number): number {
  if (y <= TORSO_TOP) return y;
  if (y <= CROTCH) return TORSO_TOP + (y - TORSO_TOP) * TORSO_SCALE;
  return TORSO_TOP + (CROTCH - TORSO_TOP) * TORSO_SCALE + (y - CROTCH) * LEG_SCALE;
}

function armY(y: number): number {
  const shoulder = torsoY(SHOULDER_Y);
  if (y <= SHOULDER_Y) return torsoY(y);
  if (y <= WRIST_Y) return shoulder + (y - SHOULDER_Y) * ARM_SCALE;
  return shoulder + (WRIST_Y - SHOULDER_Y) * ARM_SCALE + (y - WRIST_Y) * 0.92;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function reshapePoint(x: number, y: number): [number, number] {
  // Blend between torso (0) and arm (1); in the left half the arms lie left of x ≈ 68–74.
  const w = y > SHOULDER_Y ? Math.min(1, Math.max(0, (74 - x) / 6)) : 0;
  // Arms get a little thicker around their axis (shoulder → wrist) and move in slightly.
  const axis = 64 + ((Math.min(y, 290) - 110) * (38 - 64)) / (240 - 110);
  const thick = axis + (x - axis) * 1.2;
  const ax = thick + (70 - thick) * 0.12;
  return [r1(x + (ax - x) * w), r1(torsoY(y) * (1 - w) + armY(y) * w)];
}

/** Applies the proportions to an absolute M/L/C/Q path. */
function reshape(d: string): string {
  return d.replace(/([MLCQ])([^MLCQZ]*)/g, (_, cmd: string, args: string) => {
    const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const out: number[] = [];
    for (let i = 0; i + 1 < n.length; i += 2) out.push(...reshapePoint(n[i], n[i + 1]));
    return `${cmd}${out.join(' ')} `;
  });
}

const VIEW_H = Math.ceil(torsoY(424));

/** Closed outline from a left-side path that starts and ends on the centre line. */
function outline(rawStart: [number, number], rawSegs: Seg[]): string {
  const start = reshapePoint(...rawStart);
  const segs = rawSegs.map((s) => [...reshapePoint(s[0], s[1]), ...reshapePoint(s[2], s[3]), ...reshapePoint(s[4], s[5])] as Seg);
  const pts: [number, number][] = [start, ...segs.map((s) => [s[4], s[5]] as [number, number])];
  const left = segs.map((s) => `C${s.join(' ')}`).join(' ');
  const right = segs
    .map((s, i) => `C${VIEW_W - s[2]} ${s[3]} ${VIEW_W - s[0]} ${s[1]} ${VIEW_W - pts[i][0]} ${pts[i][1]}`)
    .reverse()
    .join(' ');
  return `M${start[0]} ${start[1]} ${left} ${right} Z`;
}

const BODY = outline(
  [110, 60],
  [
    [104, 60, 100, 62, 100, 68], // neck
    [100, 74, 99, 79, 96, 81],
    [88, 85, 78, 88, 70, 92], // trapezius
    [60, 96, 55, 106, 55, 118], // shoulder
    [54, 134, 50, 152, 46, 170], // upper arm
    [44, 178, 42, 184, 40, 190], // elbow
    [36, 206, 32, 224, 30, 238], // forearm
    [34, 242, 40, 244, 45, 242], // wrist
    [48, 228, 52, 208, 56, 192], // inner forearm
    [58, 186, 60, 180, 62, 174], // inner elbow
    [66, 158, 70, 140, 74, 124], // inner upper arm → armpit
    [76, 136, 78, 150, 79, 164], // ribcage
    [80, 180, 83, 196, 84, 206], // waist
    [83, 216, 80, 226, 79, 236], // hip
    [76, 256, 76, 280, 79, 304], // outer thigh
    [80, 316, 82, 326, 82, 336], // knee
    [79, 350, 79, 366, 83, 382], // calf
    [85, 392, 86, 400, 85, 406], // ankle
    [80, 410, 79, 416, 86, 417], // heel
    [94, 418, 101, 416, 101, 410], // toes
    [101, 404, 100, 398, 100, 390], // inner ankle
    [102, 374, 104, 358, 102, 344], // inner calf
    [101, 336, 101, 330, 102, 324], // inner knee
    [106, 300, 108, 272, 108, 252], // inner thigh
    [109, 246, 110, 244, 110, 242], // crotch
  ],
);

const PALM = reshape('M29 238 C24 244 23 254 25 262 C27 268 35 270 40 266 C45 262 47 252 45 242 Z');
const FINGERS = reshape('M25 262 L20 280 M29.5 266 L26.5 286 M34.5 267 L33.5 288 M39.5 265 L40.5 284 M44 250 L50 262');
const FACE = 'M110 12 C124 12 134 24 134 40 C134 56 124 70 110 70 C96 70 86 56 86 40 C86 24 96 12 110 12 Z';
const HAIR_FRONT = 'M86 40 C84 22 94 6 112 6 C126 6 138 16 134 38 C131 30 127 25 120 22 C114 27 103 27 97 22 C92 26 88 32 86 40 Z';
const HAIR_BACK = 'M86 42 C84 22 94 6 110 6 C126 6 136 20 134 42 C132 56 122 64 110 64 C98 64 88 56 86 42 Z';

interface Shape {
  d: string;
  muscle?: MuscleGroup;
}

const DELT = 'M72 94 C62 96 56 106 55 118 C55 128 57 136 60 142 C63 134 68 126 74 120 C77 112 80 104 80 98 C78 95 75 94 72 94 Z';
const UPPER_ARM = 'M57 128 C62 124 68 124 72 128 C72 142 68 158 62 170 C57 174 51 172 49 166 C50 152 52 138 57 128 Z';
const FOREARM = 'M46 182 C51 178 56 178 59 182 C56 198 51 216 44 232 L35 232 C35 214 39 198 46 182 Z';

const FRONT_RAW: Shape[] = [
  { d: FOREARM },
  { d: 'M99 78 C93 84 84 88 74 91 L104 92 C103 87 101 82 99 78 Z', muscle: 'ruecken' },
  { d: DELT, muscle: 'schultern' },
  { d: 'M82 96 C90 93 100 93 108.5 94 L108.5 136 C101 141 91 141 84 136 C78 131 76 122 77 112 C78 106 80 100 82 96 Z', muscle: 'brust' },
  { d: UPPER_ARM, muscle: 'bizeps' },
  { d: 'M80 140 L88 144 L87 148 L79.5 146 Z', muscle: 'core' },
  { d: 'M80 150 L88 153.5 L87 157.5 L80 156 Z', muscle: 'core' },
  { d: 'M98.5 142 C102 141 106 141 108.5 142 L108.5 158 L98 158 C97.5 152 97.5 147 98.5 142 Z', muscle: 'core' },
  { d: 'M98 161 L108.5 161 L108.5 178 L98 178 C97.6 172 97.6 167 98 161 Z', muscle: 'core' },
  { d: 'M98 181 L108.5 181 L108.5 198 L98.5 198 C98 192 98 187 98 181 Z', muscle: 'core' },
  { d: 'M98.5 201 L108.5 201 L108.5 236 C104 233 100 224 98.5 214 Z', muscle: 'core' },
  { d: 'M84 160 C88 164 93 168 95.5 174 L96 214 C92 218 88 218 85.5 214 C84.5 196 83.5 178 84 160 Z', muscle: 'core' },
  { d: 'M100 252 C104.5 260 107 270 107 283 C103.5 279 100.5 271 98.5 262 Z', muscle: 'beine' },
  { d: 'M80 244 C86 250 90 264 92 280 C93 298 91 314 88 328 C83 325 80 315 79 303 C76 284 76 264 80 244 Z', muscle: 'beine' },
  { d: 'M89 246 C95 253 100 266 101 282 C102 298 99 312 97 320 C93 320 91 313 90 303 C88 284 87 264 89 246 Z', muscle: 'beine' },
  { d: 'M99 296 C103 302 105 312 103.5 323 C101.5 329 98 330 95.5 327 C95.5 317 96.5 305 99 296 Z', muscle: 'beine' },
  { d: 'M81 352 C84 349 88 349 89 353 C89 366 88 378 88 390 C83 382 80 368 81 352 Z', muscle: 'waden' },
  { d: 'M99.5 350 C102.5 354 104 364 103 376 C102 385 100.5 391 99.5 396 C99 380 99 364 99.5 350 Z', muscle: 'waden' },
  { d: 'M89 352 C93 349 97 349 99 353 C99 370 97 386 95 402 L92 402 C90 386 88 368 89 352 Z', muscle: 'waden' },
];

/** Thin skin-coloured lines inside muscles – decoration only. */
const FRONT_LINES_RAW = [
  'M68 98 C63 108 59 120 57 132', // delt heads
  'M108 104 C99 104 89 106 80 110', // upper chest
  'M62 129 C63 143 62 156 59 168', // biceps heads
  'M51 185 C49 201 46 217 41 230', // forearm
  'M86 178 L95 186 M86 194 L96 202', // obliques
];

const BACK_RAW: Shape[] = [
  { d: FOREARM },
  { d: 'M110 70 C107 76 103 81 99 83 C91 86 81 89 72 92 C81 97 92 104 99 116 C104 128 107 146 110 166 Z', muscle: 'ruecken' },
  { d: DELT, muscle: 'schultern' },
  { d: 'M82 110 C88 112 95 118 98 126 C96 134 90 139 83 141 C79 133 79 121 82 110 Z', muscle: 'ruecken' },
  { d: 'M78 138 C84 143 92 149 98 153 C102 166 103 182 102 196 C96 207 90 214 84 220 C82 210 81 198 80 184 C79 168 78 152 78 138 Z', muscle: 'ruecken' },
  { d: 'M101 166 C104.5 166 108 168 108.5 171 L108.5 236 C105 236 101.5 234 99.5 230 C100 212 101.5 188 101 166 Z', muscle: 'ruecken' },
  { d: UPPER_ARM, muscle: 'trizeps' },
  { d: 'M82 230 C90 226 100 226 108.5 229 L108.5 239 C99 237 90 239 82.5 244 Z', muscle: 'po' },
  { d: 'M82 246 C91 240 101 240 108.5 242 L108.5 286 C100 292 90 290 83 282 C79 272 78 258 82 246 Z', muscle: 'po' },
  { d: 'M79 290 C85 296 91 304 93 314 C94 322 92 330 90 336 C85 332 81 324 79.5 314 C78 306 78 298 79 290 Z', muscle: 'beinbeuger' },
  { d: 'M93.5 292 C98.5 296 104 300 105.5 304 C105.5 316 103.5 326 101 336 C97.5 336 94.5 332 93.5 324 C93 314 92.5 302 93.5 292 Z', muscle: 'beinbeuger' },
  { d: 'M86 390 C90 395 97 398 101.5 395 C100 401 97.5 405 95.5 407 L91 407 C88.5 401 87 396 86 390 Z', muscle: 'waden' },
  { d: 'M81 352 C86 347 92 347 96 352 C97 364 95 378 91 390 C86 386 82 376 81 364 Z', muscle: 'waden' },
  { d: 'M96 351 C100.5 347 104 352 104 362 C104.5 374 101.5 386 97 394 C95 380 95 364 96 351 Z', muscle: 'waden' },
];

const BACK_LINES_RAW = [
  'M68 98 C63 108 59 120 57 132', // delt heads
  'M65 128 C62 142 61 152 60 160', // triceps heads
  'M53 158 C57 164 63 164 66 158',
  'M51 185 C49 201 46 217 41 230', // forearm
  'M86 126 C90 130 95 132 98 132', // teres
  'M84 160 C90 172 96 186 99 198', // lat fibres
];

const FRONT = FRONT_RAW.map((s) => ({ ...s, d: reshape(s.d) }));
const BACK = BACK_RAW.map((s) => ({ ...s, d: reshape(s.d) }));
const FRONT_LINES = FRONT_LINES_RAW.map(reshape);
const BACK_LINES = BACK_LINES_RAW.map(reshape);

const MIRROR = `matrix(-1 0 0 1 ${VIEW_W} 0)`;

/** Fill marker for the top rank (Olympionike): painted with the shimmering holo gradient. */
export const HOLO = 'holo';
const HOLO_STOPS = ['#ffd34d', '#ff5fa2', '#b06cff', '#3fd8ff'];

function reduceMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function HoloGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1" spreadMethod="reflect">
      {HOLO_STOPS.map((c, i) => (
        <stop key={c} offset={i / (HOLO_STOPS.length - 1)} stopColor={c} />
      ))}
      {!reduceMotion() && <animateTransform attributeName="gradientTransform" type="translate" values="-1 -1; 1 1; -1 -1" dur="6s" repeatCount="indefinite" />}
    </linearGradient>
  );
}

interface FigureProps {
  /** Muscle → fill color; muscles without a color stay grey. */
  fills: Partial<Record<MuscleGroup, string | undefined>>;
  selected?: MuscleGroup | null;
  onSelect?: (m: MuscleGroup) => void;
  /** Muscles that pulse (e.g. no energy left). */
  hot?: MuscleGroup[];
}

function Side({ shapes, lines, back, label, fills, selected, onSelect, hot }: FigureProps & { shapes: Shape[]; lines: string[]; back: boolean; label: string }) {
  const uid = useId().replace(/:/g, '');
  const sheen = `sheen${uid}`;
  const glow = `glow${uid}`;
  const holo = `holo${uid}`;
  const both = (key: string, render: (transform?: string) => ReactElement) => (
    <g key={key}>
      {render()}
      {render(MIRROR)}
    </g>
  );
  const muscleProps = (s: Shape) => {
    const f = s.muscle ? fills[s.muscle] : undefined;
    return {
      d: s.d,
      className: `fig-muscle${s.muscle ? ' tap' : ''}${s.muscle && hot?.includes(s.muscle) ? ' hot' : ''}`,
      fill: f === HOLO ? `url(#${holo})` : (f ?? 'var(--fig-muscle)'),
      filter: f === HOLO ? `url(#${glow})` : undefined,
      onClick: s.muscle && onSelect ? () => onSelect(s.muscle!) : undefined,
    };
  };

  return (
    <figure>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={`Körper ${label}`}>
        <defs>
          <linearGradient id={sheen} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.22" />
          </linearGradient>
          <HoloGradient id={holo} />
          <filter id={glow} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path className="fig-skin" d={BODY} />
        {both('hand', (t) => (
          <g transform={t}>
            <path className="fig-skin" d={PALM} />
            <path className="fig-finger" d={FINGERS} />
          </g>
        ))}
        {both('ear', (t) => (
          <ellipse className="fig-skin" cx="86.5" cy="44" rx="4.5" ry="7" transform={t} />
        ))}
        <path className="fig-skin" d={FACE} />
        {back ? (
          <path className="fig-hair" d={HAIR_BACK} />
        ) : (
          <>
            <path className="fig-hair" d={HAIR_FRONT} />
            {both('eye', (t) => (
              <g transform={t}>
                <rect className="fig-face" x="97" y="36" width="6.5" height="10" rx="3.2" />
                <circle cx="101.6" cy="39" r="1.3" fill="#fff" />
              </g>
            ))}
            <path className="fig-mouth" d="M102.5 55 Q110 62 117.5 55" />
          </>
        )}
        {shapes.map((s, i) => both(`m${i}`, (t) => <path {...muscleProps(s)} transform={t} />))}
        <g pointerEvents="none">
          {shapes.map((s, i) => both(`s${i}`, (t) => <path d={s.d} transform={t} fill={`url(#${sheen})`} />))}
          {lines.map((d, i) => both(`l${i}`, (t) => <path className="fig-line" d={d} transform={t} />))}
          {selected &&
            shapes.filter((s) => s.muscle === selected).map((s, i) => both(`x${i}`, (t) => <path className="fig-selected" d={s.d} transform={t} />))}
        </g>
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export function BodyFigure(props: FigureProps & { compact?: boolean }) {
  return (
    <div className={`body-figures${props.compact ? ' compact' : ''}`}>
      <Side {...props} shapes={FRONT} lines={FRONT_LINES} back={false} label="Vorne" />
      <Side {...props} shapes={BACK} lines={BACK_LINES} back label="Hinten" />
    </div>
  );
}

/** Level 1–5 of the blue ramp → color; 0 = untrained. */
export function levelColor(level: number): string | undefined {
  return level > 0 ? `var(--lvl-${Math.min(5, level)})` : undefined;
}

/** Rank tier 0–7 (Holz … Olympionike) → its solid color. */
export function rankColor(tier: number): string {
  return `var(--rank-${tier + 1})`;
}

/** Fill for the body figure (the top rank shimmers). */
export function rankFill(tier: number): string {
  return tier >= 7 ? HOLO : rankColor(tier);
}

/** CSS background for bars and legend swatches. */
export function rankBackground(tier: number): string {
  return tier >= 7 ? 'var(--rank-8-bg)' : rankColor(tier);
}

// ---------------------------------------------------------------------------
// Rank emblems: hexagon with a muscle symbol; wings and extras grow with the rank.

/** Symbols in a ±9 box around the emblem centre: light shape with a dark outline and detail lines. */
interface EmblemIcon {
  d: string;
  /** Individual muscles drawn lighter on top of the shape. */
  blocks?: string;
  lines?: string;
  /** Darker facets (faceted star). */
  facets?: string;
  /** Size relative to the other symbols. */
  scale?: number;
}

/** Faceted star for the overall rank and the plaques. */
const STAR_ICON: EmblemIcon = {
  d: 'M0.0 -6.7 L1.82 -2.01 L6.85 -1.72 L2.95 1.46 L4.23 6.32 L0.0 3.6 L-4.23 6.32 L-2.95 1.46 L-6.85 -1.72 L-1.82 -2.01 Z',
  facets: 'M0 0.5 L0.0 -6.7 L1.82 -2.01 Z M0 0.5 L6.85 -1.72 L2.95 1.46 Z M0 0.5 L4.23 6.32 L0.0 3.6 Z M0 0.5 L-4.23 6.32 L-2.95 1.46 Z M0 0.5 L-6.85 -1.72 L-1.82 -2.01 Z',
};

const ARM: EmblemIcon = {
  d: 'M-3.4 9 L-3.6 2.5 C-5.6 2.1 -6.8 0.6 -6.8 -1.4 L-6.8 -6.8 C-6.8 -8.4 -5.8 -9.4 -4.3 -9.4 L4.4 -9.4 C5.9 -9.4 6.9 -8.4 6.9 -6.8 L6.9 -1.2 C6.9 0.9 5.8 2.2 4.1 2.6 L4 9 Z',
  blocks: 'M-6.0 -7.1000000000000005 C-6.0 -7.815 -5.415 -8.4 -4.7 -8.4 L-4.5 -8.4 C-3.785 -8.4 -3.2 -7.815 -3.2 -7.1000000000000005 L-3.2 -5.8999999999999995 C-3.2 -5.185 -3.785 -4.6 -4.5 -4.6 L-4.7 -4.6 C-5.415 -4.6 -6.0 -5.185 -6.0 -5.8999999999999995 Z M-3.0 -7.6000000000000005 C-3.0 -8.315 -2.415 -8.9 -1.7 -8.9 L-1.5 -8.9 C-0.7850000000000001 -8.9 -0.2 -8.315 -0.2 -7.6000000000000005 L-0.2 -5.8999999999999995 C-0.2 -5.185 -0.7850000000000001 -4.6 -1.5 -4.6 L-1.7 -4.6 C-2.415 -4.6 -3.0 -5.185 -3.0 -5.8999999999999995 Z M0.0 -7.500000000000001 C0.0 -8.215 0.5850000000000001 -8.8 1.3 -8.8 L1.4999999999999998 -8.8 C2.215 -8.8 2.8 -8.215 2.8 -7.500000000000001 L2.8 -5.8999999999999995 C2.8 -5.185 2.215 -4.6 1.4999999999999998 -4.6 L1.3 -4.6 C0.5850000000000001 -4.6 0.0 -5.185 0.0 -5.8999999999999995 Z M3.0 -6.8999999999999995 C3.0 -7.614999999999999 3.585 -8.2 4.3 -8.2 L4.6000000000000005 -8.2 C5.315 -8.2 5.9 -7.614999999999999 5.9 -6.8999999999999995 L5.9 -5.8999999999999995 C5.9 -5.185 5.315 -4.6 4.6000000000000005 -4.6 L4.3 -4.6 C3.585 -4.6 3.0 -5.185 3.0 -5.8999999999999995 Z M-2.8 -3.3000000000000003 C-2.8 -3.795 -2.3949999999999996 -4.2 -1.9 -4.2 L-1.3 -4.2 C-0.805 -4.2 -0.4 -3.795 -0.4 -3.3000000000000003 L-0.4 -3.1 C-0.4 -2.6050000000000004 -0.805 -2.2 -1.3 -2.2 L-1.9 -2.2 C-2.3949999999999996 -2.2 -2.8 -2.6050000000000004 -2.8 -3.1 Z M0.2 -3.3000000000000003 C0.2 -3.795 0.605 -4.2 1.1 -4.2 L1.6999999999999997 -4.2 C2.1949999999999994 -4.2 2.5999999999999996 -3.795 2.5999999999999996 -3.3000000000000003 L2.5999999999999996 -3.1 C2.5999999999999996 -2.6050000000000004 2.1949999999999994 -2.2 1.6999999999999997 -2.2 L1.1 -2.2 C0.605 -2.2 0.2 -2.6050000000000004 0.2 -3.1 Z M3.2 -3.3000000000000003 C3.2 -3.795 3.6050000000000004 -4.2 4.1000000000000005 -4.2 L4.8 -4.2 C5.295 -4.2 5.7 -3.795 5.7 -3.3000000000000003 L5.7 -3.1 C5.7 -2.6050000000000004 5.295 -2.2 4.8 -2.2 L4.1000000000000005 -2.2 C3.6050000000000004 -2.2 3.2 -2.6050000000000004 3.2 -3.1 Z M-6.2 -2.6 C-4 -3.2 -0.8 -3 1.8 -1.8 C2.8 -1.4 3 -0.2 2.1 0.4 C0 1.1 -3 0.9 -5.8 0.5 C-6.5 -0.4 -6.6 -1.8 -6.2 -2.6 Z M-2.8 3 C-1.2 3.5 1.6 3.5 3.4 3 C3.7 5 3.5 7 3.3 8.7 L-2.7 8.7 C-2.9 7 -3.1 5 -2.8 3 Z',
  lines: 'M-1 -1.4 C0 -1.2 0.9 -0.8 1.5 -0.3 M-3.6 2.5 C-1.2 3 1.6 3 4.1 2.6',
  scale: 0.85,
};
const BACK_ICON: EmblemIcon = {
  d: 'M-8.8 -5.4 C-8 -7.6 -5 -8.6 -2.2 -8.8 L-1.2 -9.2 L1.2 -9.2 L2.2 -8.8 C5 -8.6 8 -7.6 8.8 -5.4 C9 -2.6 7.8 0 5.2 2.4 C4 3.6 3.4 5.6 3.6 9 L-3.6 9 C-3.4 5.6 -4 3.6 -5.2 2.4 C-7.8 0 -9 -2.6 -8.8 -5.4 Z',
  lines: 'M0 -8.8 L0 8.6 M-1.6 -8.8 C-2.6 -6.8 -4 -5.6 -6.6 -5.4 M1.6 -8.8 C2.6 -6.8 4 -5.6 6.6 -5.4 M-6.6 -5.4 C-5 -2.8 -3 -1.2 -0.6 -0.8 M6.6 -5.4 C5 -2.8 3 -1.2 0.6 -0.8 M-5.2 2.4 C-3.4 1.8 -1.8 2.8 -0.6 4.4 M5.2 2.4 C3.4 1.8 1.8 2.8 0.6 4.4 M-2.2 5.2 L-2.2 9 M2.2 5.2 L2.2 9',
};
const CHEST: EmblemIcon = {
  d: 'M-9 -2.6 C-9 -5.6 -7.6 -7.6 -5 -8 L-2 -8.4 C-1.2 -7.2 1.2 -7.2 2 -8.4 L5 -8 C7.6 -7.6 9 -5.6 9 -2.6 L8.6 3.6 L6.4 3.8 L6.2 7.6 C4 8.6 -4 8.6 -6.2 7.6 L-6.4 3.8 L-8.6 3.6 Z',
  lines: 'M-6.2 -7.6 C-5.6 -4.6 -6 -1 -6.4 3.8 M6.2 -7.6 C5.6 -4.6 6 -1 6.4 3.8 M-6.2 2.6 C-4.4 4.4 -1.8 4.6 0 3.4 C1.8 4.6 4.4 4.4 6.2 2.6 M0 -7.4 L0 3.4 M-1.6 -7.6 C-3 -6.8 -4.6 -6.6 -6 -6.8 M1.6 -7.6 C3 -6.8 4.6 -6.6 6 -6.8 M-2.6 6 L2.6 6',
};
const ABS: EmblemIcon = {
  d: 'M-7.8 -9.2 C-7.4 -5 -7.2 -1 -6.4 2.6 C-5.6 5.6 -3.6 8.2 0 9.4 C3.6 8.2 5.6 5.6 6.4 2.6 C7.2 -1 7.4 -5 7.8 -9.2 Z',
  blocks: 'M-0.7 -8.6 C-2.6 -8.8 -4.4 -8.6 -5 -8 C-5.3 -6.8 -5.2 -5.6 -4.8 -4.8 C-3.4 -4.4 -2 -4.4 -0.7 -4.8 Z M-0.7 -3.8 C-2.2 -3.4 -3.8 -3.4 -4.9 -3.8 C-5.2 -2.6 -5.1 -1.2 -4.7 -0.2 C-3.4 0.2 -2 0.2 -0.7 -0.2 Z M-0.7 0.8 C-2.1 1.2 -3.5 1.2 -4.5 0.8 C-4.7 2 -4.5 3.2 -4 4.2 C-2.8 4.4 -1.6 4.4 -0.7 4.1 Z M-0.7 5.1 C-1.6 5.4 -2.8 5.3 -3.6 5.1 C-3.2 6.6 -2.2 7.8 -0.7 8.6 Z M 0.7 -8.6 C 2.6 -8.8 4.4 -8.6 5 -8 C 5.3 -6.8 5.2 -5.6 4.8 -4.8 C 3.4 -4.4 2 -4.4 0.7 -4.8 Z M 0.7 -3.8 C 2.2 -3.4 3.8 -3.4 4.9 -3.8 C 5.2 -2.6 5.1 -1.2 4.7 -0.2 C 3.4 0.2 2 0.2 0.7 -0.2 Z M 0.7 0.8 C 2.1 1.2 3.5 1.2 4.5 0.8 C 4.7 2 4.5 3.2 4 4.2 C 2.8 4.4 1.6 4.4 0.7 4.1 Z M 0.7 5.1 C 1.6 5.4 2.8 5.3 3.6 5.1 C 3.2 6.6 2.2 7.8 0.7 8.6 Z',
  lines: 'M-7.4 -6.6 C-6.4 -5.6 -6 -4.4 -5.8 -3.2 M-7 -2.6 C-6.2 -1.4 -5.8 0 -5.6 1.6 M-6.4 3 C-5.6 4.4 -4.8 5.6 -4 6.6 M7.4 -6.6 C6.4 -5.6 6 -4.4 5.8 -3.2 M7 -2.6 C6.2 -1.4 5.8 0 5.6 1.6 M6.4 3 C5.6 4.4 4.8 5.6 4 6.6',
};
const LEG: EmblemIcon = {
  d: 'M-0.6 -9 L-6.8 -8.8 C-7.8 -6.6 -7.8 -3 -6 0 C-6.6 1.6 -6.6 3.6 -5.4 5.8 C-5 6.6 -4.8 7.2 -4.8 7.8 C-5.6 8.2 -5.8 9 -5 9 L-1.6 9 C-1.4 8.4 -1.8 7.8 -2.2 7.4 C-2.2 5.4 -1.6 3.4 -1.8 1.6 C-2 0.8 -2 0.2 -1.6 -0.4 C-1 -2.8 -0.6 -5.6 -0.6 -9 Z M 0.6 -9 L 6.8 -8.8 C 7.8 -6.6 7.8 -3 6 0 C 6.6 1.6 6.6 3.6 5.4 5.8 C 5 6.6 4.8 7.2 4.8 7.8 C 5.6 8.2 5.8 9 5 9 L 1.6 9 C 1.4 8.4 1.8 7.8 2.2 7.4 C 2.2 5.4 1.6 3.4 1.8 1.6 C 2 0.8 2 0.2 1.6 -0.4 C 1 -2.8 0.6 -5.6 0.6 -9 Z',
  blocks: 'M-6.4 -8.2 C-7.2 -5.8 -7.2 -3 -5.8 -0.8 C-5 -1.8 -4.6 -3.6 -4.6 -5.4 C-4.6 -6.6 -5.2 -7.6 -6.4 -8.2 Z M-4.1 -8.4 C-3.1 -6.8 -2.7 -4.6 -3.1 -2.6 C-3.3 -1.8 -3.7 -1.3 -4.1 -1 C-4.2 -2.6 -4.1 -4.8 -4.2 -6.4 C-4.2 -7.2 -4.2 -7.9 -4.1 -8.4 Z M-2 -3.6 C-1.4 -2.6 -1.4 -1.2 -2 -0.4 C-2.6 0 -3.4 -0.2 -3.6 -0.8 C-3.6 -2 -3 -3.2 -2 -3.6 Z M-1 -8.4 C-1 -6.6 -1.2 -5.2 -1.5 -4.2 C-2.4 -5.2 -2.8 -6.8 -2.9 -8.4 Z M-3.6 -0.3 C-3 -0.3 -2.6 0.1 -2.6 0.6 C-2.6 1.1 -3 1.5 -3.6 1.5 C-4.2 1.5 -4.6 1.1 -4.6 0.6 C-4.6 0.1 -4.2 -0.3 -3.6 -0.3 Z M-5.6 1.8 C-6.2 3 -6 4.4 -5.2 5.6 C-4.7 4.6 -4.5 3.2 -4.7 2.3 C-4.9 1.9 -5.2 1.7 -5.6 1.8 Z M-4 2 C-3.2 2.2 -2.6 2.6 -2.4 3.2 C-2.6 4.6 -3 6 -3.4 7 C-4 5.6 -4.2 3.6 -4 2 Z M 6.4 -8.2 C 7.2 -5.8 7.2 -3 5.8 -0.8 C 5 -1.8 4.6 -3.6 4.6 -5.4 C 4.6 -6.6 5.2 -7.6 6.4 -8.2 Z M 4.1 -8.4 C 3.1 -6.8 2.7 -4.6 3.1 -2.6 C 3.3 -1.8 3.7 -1.3 4.1 -1 C 4.2 -2.6 4.1 -4.8 4.2 -6.4 C 4.2 -7.2 4.2 -7.9 4.1 -8.4 Z M 2 -3.6 C 1.4 -2.6 1.4 -1.2 2 -0.4 C 2.6 0 3.4 -0.2 3.6 -0.8 C 3.6 -2 3 -3.2 2 -3.6 Z M 1 -8.4 C 1 -6.6 1.2 -5.2 1.5 -4.2 C 2.4 -5.2 2.8 -6.8 2.9 -8.4 Z M 3.6 -0.3 C 3 -0.3 2.6 0.1 2.6 0.6 C 2.6 1.1 3 1.5 3.6 1.5 C 4.2 1.5 4.6 1.1 4.6 0.6 C 4.6 0.1 4.2 -0.3 3.6 -0.3 Z M 5.6 1.8 C 6.2 3 6 4.4 5.2 5.6 C 4.7 4.6 4.5 3.2 4.7 2.3 C 4.9 1.9 5.2 1.7 5.6 1.8 Z M 4 2 C 3.2 2.2 2.6 2.6 2.4 3.2 C 2.6 4.6 3 6 3.4 7 C 4 5.6 4.2 3.6 4 2 Z',
};

/** Five motifs: arms (incl. shoulders), back, chest, abs and legs (incl. glutes, hamstrings, calves). */
const ICONS: Record<MuscleGroup | 'gesamt', EmblemIcon> = {
  gesamt: STAR_ICON,
  brust: CHEST,
  ruecken: BACK_ICON,
  schultern: ARM,
  bizeps: ARM,
  trizeps: ARM,
  core: ABS,
  beine: LEG,
  po: LEG,
  beinbeuger: LEG,
  waden: LEG,
  cardio: { d: 'M0 6 C-8 0 -7 -6 -3.5 -6 C-1.8 -6 -0.6 -5 0 -3.6 C0.6 -5 1.8 -6 3.5 -6 C7 -6 8 0 0 6 Z' },
};

const HEX = 'M32 5.5 L46.3 13.75 L46.3 30.25 L32 38.5 L17.7 30.25 L17.7 13.75 Z';
const HEX_INNER = 'M32 9.2 L43.1 15.6 L43.1 28.4 L32 34.8 L20.9 28.4 L20.9 15.6 Z';
// Bevel facets between the outer and inner hexagon (light from the top left).
const HEX_OUT_PTS = [[32, 5.5], [46.3, 13.75], [46.3, 30.25], [32, 38.5], [17.7, 30.25], [17.7, 13.75]];
const HEX_IN_PTS = [[32, 9.2], [43.1, 15.6], [43.1, 28.4], [32, 34.8], [20.9, 28.4], [20.9, 15.6]];
const BEVEL = HEX_OUT_PTS.map((o, i) => {
  const j = (i + 1) % 6;
  return { d: `M${o} L${HEX_OUT_PTS[j]} L${HEX_IN_PTS[j]} L${HEX_IN_PTS[i]} Z`, light: [true, true, false, false, false, true][i], opacity: [0.32, 0.12, 0.12, 0.24, 0.1, 0.22][i] };
});
const TAB = 'M28.4 37.4 L35.6 37.4 L34.6 42.4 L29.4 42.4 Z';
const WINGS = {
  small: 'M20 17 C15 15 10 15 6 16.5 C8.5 17.2 10 18 11 19 C8.6 19.4 7 20.4 6 21.8 C9 22 11.6 22.8 13.6 24 C15.4 25.2 17.6 26.6 20 27.2 Z',
  medium:
    'M20 16 C14 12.5 8 12 3 13.5 C6 14.4 8 15.5 9.2 16.8 C6 17 3.8 18.2 2.6 19.8 C6 20 8.8 20.8 10.8 22 C8.4 22.6 6.8 23.8 6 25.2 C10 25.2 13.6 26 16.4 27.4 C17.8 28 19 28.6 20 29 Z',
  large:
    'M20 15 C13 9 6 7.5 0.5 8.5 C3.8 9.8 6 11.4 7.4 13 C4 13.2 1.6 14.6 0.4 16.6 C4 16.8 7 17.8 9 19.2 C5.8 19.8 3.6 21.2 2.6 23 C6.6 23 10 23.8 12.8 25.2 C10.6 26 9.2 27.2 8.6 28.6 C12.6 28.4 16.4 29 20 30 Z',
  demon:
    'M20 16 C16 10 10 6 2 5 C5 8 6 10 6.5 12.5 C4 12 2 12.5 0.5 14 C3.5 15 5 16.5 5.5 18.5 C3.5 18.5 2 19.5 1 21 C4.5 21.5 7 23 8.5 25 C6.5 25.5 5.5 26.5 5 28 C9.5 27.5 14 28.5 20 30.5 Z',
};
const HORN = 'M27.2 8.4 C25.2 4.6 22.2 2.2 18.2 1.4 C20.8 3.4 22.4 5.6 23.4 9.6 Z';
const CROWN = 'M25.6 7.6 L26.8 1.6 L29.8 4.6 L32 0 L34.2 4.6 L37.2 1.6 L38.4 7.6 Z';
const SPEAR = 'M17 44 L47.5 3.5';
const SPEAR_HEAD = 'M47.5 3.5 L42.6 5.4 L45.2 6.6 L45.8 9.4 Z';
const M_MIRROR = 'matrix(-1 0 0 1 64 0)';

/**
 * Rank emblem with the muscle's symbol. Holz–Silber: plain; Gold: small wings;
 * Platin: bigger wings; Diamant: large wings and a spear; Champion: dark
 * horned wings; Olympionike: holo, large wings and a crown.
 */
export function RankEmblem({
  tier,
  level,
  muscle = 'gesamt',
  size = 24,
  pips = true,
}: {
  tier: number;
  level?: number;
  muscle?: MuscleGroup | 'gesamt';
  size?: number;
  pips?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const top = tier >= 7;
  const fill = top ? `url(#rh${uid})` : rankColor(tier);
  const sheen = `url(#rs${uid})`;
  const wing = tier >= 7 || tier === 5 ? WINGS.large : tier === 6 ? WINGS.demon : tier === 4 ? WINGS.medium : tier === 3 ? WINGS.small : null;
  const n = pips && level !== undefined ? (level % 3) + 1 : 0;
  const icon = ICONS[muscle];
  const pair = (render: (t?: string) => ReactElement) => [undefined, M_MIRROR].map((t) => <g key={t ?? 'l'}>{render(t)}</g>);
  return (
    <svg className={`rank-emblem${top ? ' olymp' : ''}`} width={(size * 64) / 46} height={size} viewBox="0 0 64 46" aria-hidden>
      <defs>
        {top && <HoloGradient id={`rh${uid}`} />}
        <linearGradient id={`rs${uid}`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#000" stopOpacity="0.32" />
        </linearGradient>
      </defs>
      {tier === 5 && (
        <g>
          <path d={SPEAR} stroke={fill} strokeWidth="2.2" strokeLinecap="round" />
          <path d={SPEAR} stroke="#fff" strokeOpacity="0.45" strokeWidth="0.8" strokeLinecap="round" />
          <path d={SPEAR_HEAD} style={{ fill }} stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
        </g>
      )}
      {wing &&
        pair((t) =>
          tier === 6 ? (
            <g transform={t}>
              <path d={wing} transform="translate(-1.6 0)" fill="#2a0b12" stroke={fill} strokeWidth="1.1" strokeLinejoin="round" />
            </g>
          ) : (
            <g transform={t}>
              <g transform="translate(-1.6 0)">
                <path d={wing} style={{ fill }} stroke="rgba(0,0,0,0.3)" strokeWidth="0.6" />
                <path d={wing} fill={sheen} />
              </g>
            </g>
          ),
        )}
      {tier === 6 && pair((t) => <path d={HORN} transform={t} fill="#2a0b12" stroke={fill} strokeWidth="0.9" />)}
      <path d={TAB} style={{ fill }} stroke="rgba(0,0,0,0.32)" strokeWidth="0.6" />
      <path d={HEX} style={{ fill }} stroke="rgba(0,0,0,0.4)" strokeWidth="0.9" />
      {BEVEL.map((b) => (
        <path key={b.d} d={b.d} fill={b.light ? '#fff' : '#000'} fillOpacity={b.opacity} />
      ))}
      <path d={HEX_INNER} style={{ fill }} stroke="rgba(0,0,0,0.3)" strokeWidth="0.6" />
      <path d={HEX_INNER} fill="#fff" fillOpacity="0.14" />
      <g transform={`translate(32 22) scale(${1.18 * (icon.scale ?? 1)})`}>
        <path d={icon.d} fill="#fff" />
        <path d={icon.d} style={{ fill }} fillOpacity={icon.blocks ? 0.45 : 0.22} stroke="rgba(0,0,0,0.5)" strokeWidth="0.9" strokeLinejoin="round" />
        {icon.blocks && (
          <>
            <path d={icon.blocks} fill="#fff" stroke="rgba(0,0,0,0.45)" strokeWidth="0.6" strokeLinejoin="round" />
            <path d={icon.blocks} style={{ fill }} fillOpacity="0.1" />
          </>
        )}
        {icon.facets && <path d={icon.facets} style={{ fill }} fillOpacity="0.38" />}
        {icon.lines && <path d={icon.lines} fill="none" stroke="rgba(0,0,0,0.42)" strokeWidth="0.8" strokeLinecap="round" />}
      </g>
      {top && <path d={CROWN} style={{ fill }} stroke="rgba(0,0,0,0.35)" strokeWidth="0.6" strokeLinejoin="round" />}
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={32 + (i - (n - 1) / 2) * 2.5} cy="40" r="0.95" fill="#fff" />
      ))}
    </svg>
  );
}

/** Emblem plus the rank name. */
export function RankBadge({ tier, level, name, size = 20, muscle }: { tier: number; level: number; name: string; size?: number; muscle?: MuscleGroup }) {
  return (
    <span className="rank-badge">
      <RankEmblem tier={tier} level={level} muscle={muscle} size={size * 1.2} />
      {name}
    </span>
  );
}

/** All ranks in a row with an arrow above the current one. */
export function RankLadder({ tier }: { tier: number | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    const cur = box?.querySelector<HTMLElement>('.rank-step.current');
    if (box && cur) box.scrollLeft = cur.offsetLeft - (box.clientWidth - cur.clientWidth) / 2;
  }, [tier]);
  return (
    <div className="rank-ladder" role="list" aria-label="Alle Ränge" ref={ref}>
      {RANK_NAMES.map((name, i) => (
        <div key={name} role="listitem" className={`rank-step${i === tier ? ' current' : ''}`} aria-current={i === tier ? 'true' : undefined}>
          <span className="rank-arrow" aria-hidden>
            {i === tier ? '↓' : ''}
          </span>
          <RankEmblem tier={i} size={34} pips={false} />
          <span className="rank-step-name">{name}</span>
        </div>
      ))}
    </div>
  );
}

/** One ring per muscle in its rank color (grey = no rank yet). */
export function RankRings({ items }: { items: { muscle: MuscleGroup; label: string; tier: number | null }[] }) {
  return (
    <div className="rank-rings">
      {items.map((it) => (
        <span
          key={it.muscle}
          className="rank-ring"
          title={it.label}
          aria-label={it.label}
          style={{ ['--ring' as string]: it.tier === null ? 'var(--muted)' : rankBackground(it.tier) }}
        />
      ))}
    </div>
  );
}
