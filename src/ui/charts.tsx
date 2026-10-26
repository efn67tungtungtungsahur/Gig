import { useState, type PointerEvent } from 'react';

const W = 320;
const PAD_L = 30;
const PAD_R = 8;
const PAD_T = 8;
const PAD_B = 18;

/** Round axis maximum to a clean number. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

function compact(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}K`;
  return v.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}

export interface BarDatum {
  key: string;
  /** Short x label (e.g. "Mo"). */
  label: string;
  /** Stack from the baseline up; index = series. */
  values: number[];
  /** Readout shown when the bar is tapped. */
  readout: string;
}

export interface Series {
  label: string;
  color: string;
}

/** Path for a bar segment with a 4px rounded top end and a square base. */
function roundedTop(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export function BarChart({
  data,
  series,
  height = 150,
  goal,
  goalLabel = 'Ziel',
  formatY = compact,
  ariaLabel,
}: {
  data: BarDatum[];
  series: Series[];
  height?: number;
  goal?: number;
  goalLabel?: string;
  formatY?: (v: number) => string;
  ariaLabel: string;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const totals = data.map((d) => d.values.reduce((a, b) => a + b, 0));
  const max = niceMax(Math.max(goal ?? 0, ...totals) * 1.05);
  const plotH = height - PAD_T - PAD_B;
  const plotW = W - PAD_L - PAD_R;
  const band = plotW / Math.max(1, data.length);
  const barW = Math.min(24, band * 0.62);
  const y = (v: number) => PAD_T + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const labelEvery = data.length > 10 ? 2 : 1;

  return (
    <div>
      <div className="readout" aria-live="polite">
        {sel !== null ? <strong>{data[sel].readout}</strong> : <span className="muted">Tippe auf einen Balken für Details</span>}
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? 'baseline' : 'grid'} x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} />
            <text x={PAD_L - 4} y={y(t) + 3} textAnchor="end">
              {formatY(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD_L + i * band + (band - barW) / 2;
          let acc = 0;
          const visible = d.values.map((v, s) => ({ v, s })).filter((p) => p.v > 0);
          return (
            <g key={d.key} className={`bar-group ${sel !== null && sel !== i ? 'dim' : ''}`}>
              {visible.map(({ v, s }, j) => {
                const top = y(acc + v);
                const bottom = y(acc);
                acc += v;
                // 2px surface gap between stacked segments.
                const h = Math.max(0, bottom - top - (j > 0 ? 2 : 0));
                const isTop = j === visible.length - 1;
                return isTop ? (
                  <path key={s} d={roundedTop(x, top, barW, h)} fill={series[s].color} />
                ) : (
                  <rect key={s} x={x} y={top} width={barW} height={h} fill={series[s].color} />
                );
              })}
              {i % labelEvery === (data.length - 1) % labelEvery && (
                <text x={x + barW / 2} y={height - 4} textAnchor="middle">
                  {d.label}
                </text>
              )}
              <rect
                className="hit"
                x={PAD_L + i * band}
                y={PAD_T}
                width={band}
                height={plotH + PAD_B}
                onClick={() => setSel(sel === i ? null : i)}
              />
            </g>
          );
        })}
        {goal !== undefined && goal > 0 && (
          <g pointerEvents="none">
            <line className="goal" x1={PAD_L} x2={W - PAD_R} y1={y(goal)} y2={y(goal)} />
            <text x={W - PAD_R} y={y(goal) - 3} textAnchor="end" className="halo" style={{ fill: 'var(--text-2)' }}>
              {goalLabel}
            </text>
          </g>
        )}
      </svg>
      {series.length > 1 && (
        <div className="legend">
          {series.map((s) => (
            <span key={s.label}>
              <span className="key" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export interface LinePoint {
  key: string;
  label: string;
  value: number;
  readout: string;
}

export function LineChart({
  points,
  height = 140,
  color = 'var(--series-1)',
  formatY = compact,
  ariaLabel,
  unit = '',
}: {
  points: LinePoint[];
  height?: number;
  color?: string;
  formatY?: (v: number) => string;
  ariaLabel: string;
  unit?: string;
}) {
  const [sel, setSel] = useState<number | null>(null);
  if (points.length === 0) return null;
  const values = points.map((p) => p.value);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const span = Math.max(hi - lo, Math.abs(hi) * 0.02, 1);
  lo -= span * 0.25;
  hi += span * 0.25;
  const plotH = height - PAD_T - PAD_B;
  const plotW = W - PAD_L - PAD_R - 30; // room for the end label
  const x = (i: number) => PAD_L + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD_T + plotH - ((v - lo) / (hi - lo)) * plotH;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const last = points.length - 1;
  const ticks = [lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.8];

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setSel(best);
  };

  return (
    <div>
      <div className="readout" aria-live="polite">
        {sel !== null ? <strong>{points[sel].readout}</strong> : <span className="muted">Tippe oder wische über die Linie</span>}
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD_L} x2={PAD_L + plotW} y1={y(t)} y2={y(t)} />
            <text x={PAD_L - 4} y={y(t) + 3} textAnchor="end">
              {formatY(t)}
            </text>
          </g>
        ))}
        <line className="baseline" x1={PAD_L} x2={PAD_L + plotW} y1={PAD_T + plotH} y2={PAD_T + plotH} />
        <text x={PAD_L} y={height - 4}>
          {points[0].label}
        </text>
        <text x={PAD_L + plotW} y={height - 4} textAnchor="end">
          {points[last].label}
        </text>
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {sel !== null && <line className="grid" x1={x(sel)} x2={x(sel)} y1={PAD_T} y2={PAD_T + plotH} style={{ stroke: 'var(--axis)' }} />}
        {sel !== null && <circle cx={x(sel)} cy={y(points[sel].value)} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />}
        <circle cx={x(last)} cy={y(points[last].value)} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
        <text x={x(last) + 8} y={y(points[last].value) + 4} style={{ fill: 'var(--text)', fontSize: 11, fontWeight: 600 }}>
          {formatY(points[last].value)}
          {unit}
        </text>
        <rect
          className="hit"
          x={PAD_L - 6}
          y={0}
          width={plotW + 12}
          height={height}
          onPointerDown={onMove}
          onPointerMove={onMove}
        />
      </svg>
    </div>
  );
}
