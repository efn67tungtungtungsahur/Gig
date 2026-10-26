import type { MuscleGroup } from '../domain/types';

// Stylised body, front and back, in a 200 × 420 box. Paths describe the left
// half and are mirrored; `center` parts are drawn once.

interface Region {
  d: string;
  muscle?: MuscleGroup;
  center?: boolean;
}

const HEAD = 'M100 8 C111 8 118 17 118 30 C118 43 110 52 100 52 C90 52 82 43 82 30 C82 17 89 8 100 8 Z';
const NECK = 'M91 49 L109 49 L111 63 L89 63 Z';
const UPPER_ARM = 'M52 116 C55 111 60 107 65 105 C68 118 66 135 61 150 L47 150 C45 137 47 125 52 116 Z';
const DELT = 'M70 67 C60 66 51 72 49 83 C47 93 48 103 51 112 C54 108 58 104 62 101 C65 92 69 84 74 79 C75 74 74 70 70 67 Z';
const FOREARM = 'M47 154 L61 154 C60 172 57 190 55 206 L42 206 C40 190 42 170 47 154 Z';
const HAND = 'M42 210 L55 210 C57 218 56 228 50 234 C45 234 41 226 41 218 Z';
const KNEE = 'M74 304 L91 304 C92 310 91 316 89 320 L77 320 C75 315 74 310 74 304 Z';

const FRONT: Region[] = [
  { d: HEAD, center: true },
  { d: NECK, center: true },
  { d: 'M89 55 C88 60 81 63 73 65 L89 66 Z', muscle: 'ruecken' },
  { d: DELT, muscle: 'schultern' },
  { d: 'M77 68 L98 68 L98 106 C90 112 80 111 75 105 C72 99 72 92 73 88 C74 83 77 78 77 68 Z', muscle: 'brust' },
  { d: UPPER_ARM, muscle: 'bizeps' },
  { d: FOREARM },
  { d: HAND },
  { d: 'M87 112 L98 112 L98 188 C94 191 90 190 87 186 Z', muscle: 'core' },
  { d: 'M75 109 C79 111 82 113 84 115 L84 184 C80 184 77 182 75 179 C73 160 73 130 75 109 Z', muscle: 'core' },
  { d: 'M75 184 C79 188 85 192 98 194 L98 222 L71 214 C71 204 72 194 75 184 Z' },
  { d: 'M70 218 C79 220 90 225 97 230 C97 252 95 280 91 300 L74 300 C68 282 65 254 66 232 C67 226 68 221 70 218 Z', muscle: 'beine' },
  { d: KNEE },
  { d: 'M76 324 L90 324 C92 344 91 366 88 388 L80 388 C76 366 73 344 76 324 Z', muscle: 'waden' },
  { d: 'M80 392 L89 392 C91 398 93 404 91 408 L75 408 C75 402 77 396 80 392 Z' },
];

/** Thin lines inside muscles (six-pack, quad split) – decoration only. */
const FRONT_DETAIL = ['M87 136 L98 136 M87 160 L98 160', 'M84 238 C86 258 86 280 84 298'];

const BACK: Region[] = [
  { d: HEAD, center: true },
  { d: NECK, center: true },
  { d: 'M89 60 C84 63 77 66 70 68 C78 73 86 82 91 94 L98 116 L98 64 L91 64 Z', muscle: 'ruecken' },
  { d: DELT, muscle: 'schultern' },
  { d: 'M74 77 C80 82 85 90 88 100 C90 112 90 130 88 146 C86 160 82 170 78 177 C75 171 73 160 73 146 C72 124 72 100 74 77 Z', muscle: 'ruecken' },
  { d: 'M93 118 L98 118 L98 196 L85 196 C87 186 90 172 91 158 C92 144 93 130 93 118 Z', muscle: 'ruecken' },
  { d: UPPER_ARM, muscle: 'trizeps' },
  { d: FOREARM },
  { d: HAND },
  { d: 'M72 200 L98 200 L98 242 C90 249 79 248 72 240 C68 228 68 212 72 200 Z', muscle: 'po' },
  { d: 'M70 246 C78 252 90 253 97 250 C97 270 95 288 91 300 L74 300 C70 284 67 266 70 246 Z', muscle: 'beinbeuger' },
  { d: KNEE },
  { d: 'M75 324 C80 321 87 321 91 324 C94 338 93 354 89 368 L80 368 C76 354 73 338 75 324 Z', muscle: 'waden' },
  { d: 'M80 371 L89 371 L88 388 L81 388 Z' },
  { d: 'M80 392 L89 392 C90 398 91 404 90 408 L79 408 C78 402 78 396 80 392 Z' },
];

const BACK_DETAIL = ['M83 262 C84 276 84 290 83 300'];

const MIRROR = 'matrix(-1 0 0 1 200 0)';

function Side({
  regions,
  details,
  fills,
  selected,
  onSelect,
  label,
}: {
  regions: Region[];
  details: string[];
  fills: Partial<Record<MuscleGroup, string>>;
  selected?: MuscleGroup | null;
  onSelect?: (m: MuscleGroup) => void;
  label: string;
}) {
  const paint = (r: Region) => (r.muscle && fills[r.muscle]) || 'var(--body-base)';
  const shapes = (r: Region, i: number, sel: boolean) => {
    const props = {
      d: r.d,
      fill: paint(r),
      className: `region${r.muscle ? ' muscle' : ''}${sel ? ' selected' : ''}`,
      onClick: r.muscle && onSelect ? () => onSelect(r.muscle!) : undefined,
    };
    return r.center ? (
      <path key={`${label}-${i}`} {...props} />
    ) : (
      <g key={`${label}-${i}`}>
        <path {...props} />
        <path {...props} transform={MIRROR} />
      </g>
    );
  };
  return (
    <figure>
      <svg viewBox="0 0 200 420" role="img" aria-label={`Körper ${label}`}>
        {regions.map((r, i) => shapes(r, i, false))}
        {details.map((d) => (
          <g key={d}>
            <path className="detail" d={d} />
            <path className="detail" d={d} transform={MIRROR} />
          </g>
        ))}
        {/* Selected muscle on top so its outline isn't covered by neighbours. */}
        {selected && regions.filter((r) => r.muscle === selected).map((r, i) => shapes(r, 100 + i, true))}
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export function BodyFigure({
  fills,
  selected,
  onSelect,
}: {
  fills: Partial<Record<MuscleGroup, string>>;
  selected?: MuscleGroup | null;
  onSelect?: (m: MuscleGroup) => void;
}) {
  return (
    <div className="body-figures">
      <Side regions={FRONT} details={FRONT_DETAIL} fills={fills} selected={selected} onSelect={onSelect} label="Vorne" />
      <Side regions={BACK} details={BACK_DETAIL} fills={fills} selected={selected} onSelect={onSelect} label="Hinten" />
    </div>
  );
}

/** Level 1–5 → ramp color; 0 = untrained. */
export function levelColor(level: number): string | undefined {
  return level > 0 ? `var(--lvl-${Math.min(5, level)})` : undefined;
}

/** Small shield in the rank color with the division as pips. */
export function RankBadge({ tier, level, name, size = 20 }: { tier: number; level: number; name: string; size?: number }) {
  const pips = (level % 3) + 1;
  return (
    <span className="rank-badge">
      <svg width={size} height={size * 1.15} viewBox="0 0 20 23" aria-hidden>
        <path d="M10 1 L18 4 L18 11 C18 16 14.5 20 10 22 C5.5 20 2 16 2 11 L2 4 Z" fill={`var(--lvl-${tier + 1})`} />
        {Array.from({ length: pips }, (_, i) => (
          <circle key={i} cx={10 + (i - (pips - 1) / 2) * 4.2} cy={11.5} r={1.5} fill="var(--surface)" />
        ))}
      </svg>
      {name}
    </span>
  );
}
