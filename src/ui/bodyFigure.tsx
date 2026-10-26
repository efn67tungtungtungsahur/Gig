import { useId, type ReactElement } from 'react';
import type { MuscleGroup } from '../domain/types';

// Athletic body, front and back, in a 200 × 424 box. Muscles describe the
// left half and are mirrored; the silhouette outline is mirrored into one path.

type Seg = [number, number, number, number, number, number];

/** Closed outline from a left-side path that starts and ends on the centre line. */
function outline(start: [number, number], segs: Seg[]): string {
  const pts: [number, number][] = [start, ...segs.map((s) => [s[4], s[5]] as [number, number])];
  const left = segs.map((s) => `C${s.join(' ')}`).join(' ');
  const right = segs
    .map((s, i) => `C${200 - s[2]} ${s[3]} ${200 - s[0]} ${s[1]} ${200 - pts[i][0]} ${pts[i][1]}`)
    .reverse()
    .join(' ');
  return `M${start[0]} ${start[1]} ${left} ${right} Z`;
}

const SILHOUETTE = outline(
  [100, 6],
  [
    [91, 6, 85, 13, 85, 25], // head
    [85, 34, 88, 42, 92, 46], // jaw
    [93, 48, 92, 54, 90, 58], // neck
    [82, 62, 70, 63, 58, 66], // trapezius
    [48, 68, 40, 76, 39, 90], // shoulder cap
    [38, 100, 38, 108, 38, 116], // upper arm
    [38, 130, 36, 146, 36, 160], // elbow
    [33, 172, 30, 190, 31, 205], // forearm
    [32, 214, 33, 220, 34, 224], // wrist
    [31, 232, 31, 244, 36, 252], // hand
    [40, 256, 45, 254, 47, 248], // fingers
    [49, 240, 49, 232, 48, 226], // palm
    [50, 212, 54, 190, 56, 170], // inner forearm
    [57, 164, 58, 160, 59, 156], // inner elbow
    [62, 140, 63, 124, 65, 110], // inner upper arm → armpit
    [67, 120, 68, 130, 68, 140], // ribcage
    [69, 160, 72, 178, 73, 190], // waist
    [72, 200, 68, 210, 66, 222], // hip
    [63, 240, 62, 262, 64, 284], // outer thigh
    [66, 300, 70, 312, 71, 322], // knee
    [68, 336, 69, 352, 73, 366], // calf
    [76, 380, 79, 394, 80, 404], // ankle
    [77, 410, 78, 416, 84, 417], // foot
    [90, 418, 95, 416, 95, 411], // toes
    [95, 404, 93, 396, 93, 388], // inner ankle
    [95, 370, 96, 350, 94, 336], // inner calf
    [93, 328, 93, 322, 94, 316], // inner knee
    [97, 296, 99, 270, 99, 250], // inner thigh
    [99.5, 240, 100, 232, 100, 228], // crotch
  ],
);

interface Shape {
  d: string;
  muscle?: MuscleGroup;
}

const DELT = 'M62 68 C52 67 43 73 40 86 C38 96 39 106 41 114 C45 110 50 105 54 101 C58 94 62 86 66 78 C67 73 65 69 62 68 Z';
const FOREARM = 'M40 164 C45 159 53 159 58 163 C57 180 53 198 49 216 L37 216 C34 198 34 180 40 164 Z';

const FRONT: Shape[] = [
  { d: FOREARM },
  { d: 'M90 58 C82 62 72 64 62 67 L92 67 Z', muscle: 'ruecken' },
  { d: DELT, muscle: 'schultern' },
  { d: 'M67 72 C74 68 86 67 98.5 68 L98.5 112 C92 117 81 117 73 112 C67 107 64 99 64 90 C64 84 65 77 67 72 Z', muscle: 'brust' },
  { d: 'M45 116 C49 111 55 109 61 110 C64 120 63 136 59 152 C55 158 48 158 44 154 C41 142 41 128 45 116 Z', muscle: 'bizeps' },
  // Serratus
  { d: 'M68 114 C72 115 76 117 79 120 L77 124 C74 122 71 121 68 120 Z', muscle: 'core' },
  { d: 'M68 124 C72 125 76 127 79 130 L77 134 C74 132 71 131 69 130 Z', muscle: 'core' },
  { d: 'M69 134 C72 135 75 137 78 140 L76 143 C74 141 72 140 70 140 Z', muscle: 'core' },
  // Six-pack
  { d: 'M88.5 117 C92 116 96 116 98.5 117 L98.5 135 L88 135 C87.5 129 87.5 123 88.5 117 Z', muscle: 'core' },
  { d: 'M88 138 L98.5 138 L98.5 157 L88 157 C87.6 151 87.6 144 88 138 Z', muscle: 'core' },
  { d: 'M88 160 L98.5 160 L98.5 179 L88.5 179 C88 173 88 166 88 160 Z', muscle: 'core' },
  { d: 'M88.5 182 L98.5 182 L98.5 214 C94 212 90 204 88.5 196 Z', muscle: 'core' },
  { d: 'M72 144 C77 147 82 151 85 157 L85.5 196 C81 200 77 200 74 196 C73 180 72 162 72 144 Z', muscle: 'core' },
  // Quadriceps: adductors, vastus lateralis, rectus femoris, vastus medialis (overlapping, later on top)
  { d: 'M90 230 C95 238 99 250 99 268 C95 264 91 254 88.5 244 Z', muscle: 'beine' },
  { d: 'M65 226 C71 232 77 246 80 264 C82 282 80 300 76 316 C71 313 67 303 66 291 C62 271 62 248 65 226 Z', muscle: 'beine' },
  { d: 'M77 229 C84 236 90 250 91.5 266 C93 283 90 298 87 308 C83 308 80 301 79 291 C76 272 75 250 77 229 Z', muscle: 'beine' },
  { d: 'M89 278 C95 285 98 297 97 310 C95 317 90 319 85.5 316 C85.5 304 87 290 89 278 Z', muscle: 'beine' },
  // Lower leg: calf from the side, tibialis, inner calf
  { d: 'M70 340 C73 337 77 337 79 341 C79 354 78 366 78 380 C73 372 69 357 70 340 Z', muscle: 'waden' },
  { d: 'M88.5 338 C93.5 342 96 353 95 366 C94 375 92 381 90 386 C89 370 88.5 354 88.5 338 Z', muscle: 'waden' },
  { d: 'M78 340 C82 337 87 337 89 341 C89 358 87 376 85 394 L81 394 C79 376 77 358 78 340 Z', muscle: 'waden' },
];

/** Fibre and separation lines – decoration only. */
const FRONT_LINES = [
  'M92 48 C94 54 96 60 98 66', // neck
  'M57 72 C52 82 47 94 44 106', // delt heads
  'M98 79 C88 79 77 81 68 85', // upper chest
  'M97 96 C88 97 78 98 69 98',
  'M52 113 C53 127 53 141 51 155', // biceps heads
  'M47 166 C47 182 45 198 43 214', // forearm
  'M74 158 L84 166 M74 172 L85 180', // obliques
  'M74 200 C80 210 88 220 96 226', // V-line
  'M68 230 C78 250 86 270 93 296', // sartorius
];

const BACK: Shape[] = [
  { d: FOREARM },
  { d: 'M100 44 C97 50 93 56 89 59 C81 62 71 64 61 67 C70 72 81 80 89 92 C94 104 97 120 100 140 Z', muscle: 'ruecken' },
  { d: DELT, muscle: 'schultern' },
  { d: 'M71 86 C77 88 84 94 88 102 C86 110 80 115 72 117 C68 109 68 97 71 86 Z', muscle: 'ruecken' },
  { d: 'M67 114 C73 119 81 125 88 129 C92 141 93 157 92 171 C86 183 80 191 74 197 C72 187 71 175 70 161 C69 143 68 128 67 114 Z', muscle: 'ruecken' },
  { d: 'M91 140 C94.5 140 98 142 98.5 145 L98.5 212 C95 212 91.5 210 89.5 206 C90 188 91.5 164 91 140 Z', muscle: 'ruecken' },
  { d: 'M45 116 C49 111 55 109 61 110 C64 122 63 138 59 154 C54 160 47 160 43 154 C40 142 41 128 45 116 Z', muscle: 'trizeps' },
  { d: 'M68 204 C76 200 88 200 98.5 203 L98.5 214 C88 212 77 214 68.5 220 Z', muscle: 'po' },
  { d: 'M68 223 C78 216 90 216 98.5 218 L98.5 264 C90 270 78 268 70 260 C66 250 65 236 68 223 Z', muscle: 'po' },
  // Hamstrings: biceps femoris, semitendinosus
  { d: 'M65 266 C72 272 80 282 83 295 C85 307 83 318 80 326 C74 322 69 312 67 300 C64 289 64 278 65 266 Z', muscle: 'beinbeuger' },
  { d: 'M81 270 C88 274 95 279 98.5 284 C98.5 299 96.5 313 93 326 C88.5 326 84 321 83 312 C81.5 298 80.5 284 81 270 Z', muscle: 'beinbeuger' },
  // Calves: soleus, lateral and medial gastrocnemius
  { d: 'M75.5 378 C80 384 88 388 93.5 384 C92 392 88.5 399 85.5 403 L81.5 403 C78.5 396 76.5 388 75.5 378 Z', muscle: 'waden' },
  { d: 'M70 338 C75 333 82 333 86 338 C87 351 85 366 81 380 C76 376 71 365 70 352 Z', muscle: 'waden' },
  { d: 'M85 337 C90 333 95.5 338 96 348 C96.5 361 93 374 88 384 C86 369 84.5 352 85 337 Z', muscle: 'waden' },
];

const BACK_LINES = [
  'M57 72 C52 82 47 94 44 106', // delt heads
  'M53 112 C51 126 50 140 51 154', // triceps heads
  'M46 142 C50 148 55 148 59 142',
  'M47 166 C47 182 45 198 43 214', // forearm
  'M76 100 C80 104 84 106 87 106', // teres
  'M72 140 C78 150 84 162 88 176', // lat fibres
];

const MIRROR = 'matrix(-1 0 0 1 200 0)';

interface FigureProps {
  /** Muscle → fill color; muscles without a color stay grey. */
  fills: Partial<Record<MuscleGroup, string | undefined>>;
  selected?: MuscleGroup | null;
  onSelect?: (m: MuscleGroup) => void;
  /** Muscles that pulse (e.g. heavily loaded right now). */
  hot?: MuscleGroup[];
}

function Side({ shapes, lines, label, fills, selected, onSelect, hot }: FigureProps & { shapes: Shape[]; lines: string[]; label: string }) {
  const uid = useId().replace(/:/g, '');
  const sheen = `sheen${uid}`;
  const glow = `glow${uid}`;
  const both = (key: string, render: (transform?: string) => ReactElement) => (
    <g key={key}>
      {render()}
      {render(MIRROR)}
    </g>
  );
  const colored = shapes.filter((s) => s.muscle && fills[s.muscle]);
  const grey = shapes.filter((s) => !(s.muscle && fills[s.muscle]));
  const muscleProps = (s: Shape) => ({
    d: s.d,
    className: `fig-muscle${s.muscle ? ' tap' : ''}${s.muscle && hot?.includes(s.muscle) ? ' hot' : ''}`,
    onClick: s.muscle && onSelect ? () => onSelect(s.muscle!) : undefined,
  });

  return (
    <figure>
      <svg viewBox="0 0 200 424" role="img" aria-label={`Körper ${label}`}>
        <defs>
          <linearGradient id={sheen} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.32" />
          </linearGradient>
          <filter id={glow} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path className="fig-skin" d={SILHOUETTE} />
        {grey.map((s, i) => both(`g${i}`, (t) => <path {...muscleProps(s)} transform={t} fill="var(--fig-muscle)" />))}
        <g filter={`url(#${glow})`}>
          {colored.map((s, i) => both(`c${i}`, (t) => <path {...muscleProps(s)} transform={t} fill={fills[s.muscle!]} />))}
        </g>
        <g pointerEvents="none">
          {shapes.map((s, i) => both(`s${i}`, (t) => <path d={s.d} transform={t} fill={`url(#${sheen})`} />))}
          {lines.map((d, i) => both(`l${i}`, (t) => <path className="fig-line" d={d} transform={t} />))}
          {selected &&
            shapes
              .filter((s) => s.muscle === selected)
              .map((s, i) => both(`x${i}`, (t) => <path className="fig-selected" d={s.d} transform={t} filter={`url(#${glow})`} />))}
        </g>
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export function BodyFigure(props: FigureProps & { compact?: boolean }) {
  return (
    <div className={`body-figures${props.compact ? ' compact' : ''}`}>
      <Side {...props} shapes={FRONT} lines={FRONT_LINES} label="Vorne" />
      <Side {...props} shapes={BACK} lines={BACK_LINES} label="Hinten" />
    </div>
  );
}

/** Level 1–5 of the blue ramp → color; 0 = untrained. */
export function levelColor(level: number): string | undefined {
  return level > 0 ? `var(--lvl-${Math.min(5, level)})` : undefined;
}

/** Rank tier 0–6 (Holz … Champion) → its color. */
export function rankColor(tier: number): string {
  return `var(--rank-${tier + 1})`;
}

/** Shield in the rank color with the division as pips (I = three). */
export function RankBadge({ tier, level, name, size = 20 }: { tier: number; level: number; name: string; size?: number }) {
  const uid = useId().replace(/:/g, '');
  const pips = (level % 3) + 1;
  const shield = 'M10 1 L18.5 4 L18.5 11 C18.5 16.2 14.8 20.2 10 22.2 C5.2 20.2 1.5 16.2 1.5 11 L1.5 4 Z';
  return (
    <span className="rank-badge">
      <svg width={size} height={size * 1.15} viewBox="0 0 20 23.2" aria-hidden>
        <defs>
          <linearGradient id={`rb${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <path d={shield} style={{ fill: rankColor(tier) }} stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
        <path d={shield} fill={`url(#rb${uid})`} />
        <path d="M10 3.4 L16.4 5.6 L16.4 11 C16.4 15 13.6 18.2 10 19.8" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.8" />
        {Array.from({ length: pips }, (_, i) => (
          <path key={i} d={`M${10 + (i - (pips - 1) / 2) * 4.4} 9.2 l1.6 2.4 l-1.6 2.4 l-1.6 -2.4 Z`} fill="#fff" />
        ))}
      </svg>
      {name}
    </span>
  );
}
