import { useId } from 'react';
import type { Badge, BadgeCategory } from '../domain/badges';
import { RankEmblem, rankColor } from './bodyFigure';

// ---------------------------------------------------------------------------
// Activity badges (steps, distance, runs)

/** Badge colors by tier inside a category. */
const TIER_COLORS = ['#cd7f32', '#9fb0c4', '#f0b429', '#2fc0a8', '#3d8bfd', '#9b5cff', '#ef4f7d', '#ff8a00', '#00b8c9', '#d4af37'];

function rosette(points: number, outer: number, inner: number, cx = 50, cy = 48): string {
  const d: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    d.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${d.join(' L')} Z`;
}

const SHAPES: Record<BadgeCategory, string> = {
  schritte: rosette(14, 45, 40),
  strecke: 'M50 3 A45 45 0 1 1 49.99 3 Z',
  laufen: 'M50 3 L88 22 L88 70 L50 93 L12 70 L12 22 Z',
};

const ICONS: Record<BadgeCategory, { fill?: string; stroke?: string }> = {
  schritte: {
    fill: 'M-18 6 C-18 -2 -14 -6 -8 -6 L-4 -12 C-2 -14 2 -14 3 -11 L5 -4 C10 -3 16 0 18 4 L18 8 L-18 8 Z M-18 10 L18 10 L18 12 C18 13 17 14 16 14 L-16 14 C-17 14 -18 13 -18 12 Z',
  },
  strecke: {
    stroke: 'M-17 12 C-11 4 -5 14 1 6 C5 0 9 2 11 -4',
    fill: 'M11 -4 L11 -19 L12.6 -19 L12.6 -4 Z M12.6 -19 L23 -15 L12.6 -11 Z',
  },
  laufen: {
    stroke: 'M2 -9 L-2 3 M-2 3 L6 9 L4 17 M-2 3 L-8 10 L-14 10 M1 -6 L8 -1 L13 -5 M1 -6 L-6 -3 L-10 3',
    fill: 'M7.5 -15 A3.6 3.6 0 1 1 7.49 -15 Z',
  },
};

export function ActivityBadge({ badge, size = 72 }: { badge: Badge; size?: number }) {
  const uid = useId().replace(/:/g, '');
  const color = badge.earned ? TIER_COLORS[badge.tier % TIER_COLORS.length] : '#3b3a52';
  const shape = SHAPES[badge.category];
  const icon = ICONS[badge.category];
  const r = 47;
  const circ = 2 * Math.PI * r;
  return (
    <svg className={`activity-badge${badge.earned ? '' : ' locked'}`} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${badge.title}${badge.earned ? '' : ' (noch nicht erreicht)'}`}>
      <defs>
        <linearGradient id={`ab${uid}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {!badge.earned && badge.progress > 0 && (
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${circ * badge.progress} ${circ}`} transform="rotate(-90 50 50)" />
      )}
      <path d={shape} fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" />
      <path d={shape} fill={`url(#ab${uid})`} />
      <circle cx="50" cy="46" r="30" fill="#fff" fillOpacity={badge.earned ? 0.16 : 0.06} stroke="#fff" strokeOpacity={badge.earned ? 0.55 : 0.18} strokeWidth="1.2" />
      <g transform="translate(50 42)" opacity={badge.earned ? 1 : 0.35}>
        {icon.stroke && <path d={icon.stroke} fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={badge.category === 'strecke' ? '4 3.5' : undefined} />}
        {icon.fill && <path d={icon.fill} fill="#fff" />}
      </g>
      <rect x="22" y="66" width="56" height="17" rx="8.5" fill="rgba(0,0,0,0.38)" />
      <text x="50" y="78.6" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" opacity={badge.earned ? 1 : 0.6}>
        {badge.earned ? badge.short : '🔒'}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Rank plaques

const PLAQUE = 'M14 6 H106 C111 6 114 9 114 14 V112 C114 126 96 140 60 154 C24 140 6 126 6 112 V14 C6 9 9 6 14 6 Z';
const PLAQUE_INNER = 'M18 12 H102 C105.5 12 108 14.5 108 18 V110 C108 122 92 134 60 147 C28 134 12 122 12 110 V18 C12 14.5 14.5 12 18 12 Z';
const RIBBON = 'M0 90 H120 L113 99 L120 108 H0 L7 99 Z';

/** Collectible plaque for a muscle's (or the overall) rank – always with a star. */
export function RankPlaque({
  tier,
  level,
  rankName,
  label,
  date,
}: {
  tier: number | null;
  level?: number;
  rankName?: string;
  label: string;
  date?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const locked = tier === null;
  const top = tier !== null && tier >= 7;
  const fill = locked ? '#2c2b44' : top ? `url(#ph${uid})` : rankColor(tier);
  return (
    <div className={`plaque${locked ? ' locked' : ''}${top ? ' olymp' : ''}`}>
      <svg className="plaque-art" viewBox="0 0 120 160" aria-hidden>
        <defs>
          <linearGradient id={`ps${uid}`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0.04" />
            <stop offset="1" stopColor="#000" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id={`ph${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffd34d" />
            <stop offset="0.35" stopColor="#ff5fa2" />
            <stop offset="0.68" stopColor="#b06cff" />
            <stop offset="1" stopColor="#3fd8ff" />
          </linearGradient>
          <clipPath id={`pc${uid}`}>
            <path d={PLAQUE} />
          </clipPath>
        </defs>
        <path d={PLAQUE} style={{ fill }} stroke="rgba(0,0,0,0.45)" strokeWidth="1.4" />
        <path d={PLAQUE} fill={`url(#ps${uid})`} />
        {!locked && <path d="M74 0 L96 0 L42 160 L20 160 Z" fill="#fff" opacity="0.13" clipPath={`url(#pc${uid})`} />}
        <path d={PLAQUE_INNER} fill="none" stroke="#fff" strokeOpacity={locked ? 0.15 : 0.5} strokeWidth="1.4" />
        {[18, 102].map((x) => (
          <circle key={x} cx={x} cy={18} r="2.4" fill="#fff" fillOpacity={locked ? 0.2 : 0.75} stroke="rgba(0,0,0,0.35)" strokeWidth="0.6" />
        ))}
        <path d={RIBBON} fill="#15142a" stroke={locked ? '#4a4966' : fill} strokeWidth="1.6" />
      </svg>
      <div className="plaque-emblem">
        {locked ? (
          <span style={{ filter: 'grayscale(1)', opacity: 0.35 }}>
            <RankEmblem tier={0} size={56} pips={false} />
          </span>
        ) : (
          <RankEmblem tier={tier} level={level} size={56} />
        )}
      </div>
      <div className="plaque-rank" style={rankName && rankName.length > 11 ? { fontSize: `${Math.min(10.5, 128 / rankName.length)}cqw` } : undefined}>
        {locked ? 'Noch offen' : rankName}
      </div>
      <div className="plaque-label">{label}</div>
      {date && <div className="plaque-date">{date}</div>}
    </div>
  );
}
