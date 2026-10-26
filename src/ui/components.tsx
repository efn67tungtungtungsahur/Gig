import { useEffect, useState, type ReactNode } from 'react';

export function Card({ title, icon, action, children, className = '' }: { title?: ReactNode; icon?: ReactNode; action?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          {icon && <div className="icon" aria-hidden>{icon}</div>}
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, delta }: { label: string; value: ReactNode; delta?: ReactNode }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta && <div className="delta">{delta}</div>}
    </div>
  );
}

export type StatusLevel = 'good' | 'warning' | 'serious' | 'critical' | 'none';

const STATUS_SYMBOL: Record<StatusLevel, string> = { good: '✓', warning: '!', serious: '!', critical: '×', none: '–' };

/** Status always carries icon + label, never color alone. */
export function Status({ level, children }: { level: StatusLevel; children: ReactNode }) {
  const bg = level === 'none' ? 'var(--muted)' : `var(--${level})`;
  return (
    <span className="status">
      <span className="sym" style={{ background: bg, color: level === 'warning' ? '#0b0b0b' : '#fff' }} aria-hidden>
        {STATUS_SYMBOL[level]}
      </span>
      {children}
    </span>
  );
}

export function scoreLevel(score?: number): StatusLevel {
  if (score === undefined) return 'none';
  if (score >= 80) return 'good';
  if (score >= 60) return 'warning';
  if (score >= 40) return 'serious';
  return 'critical';
}

/** Score meter as a ring: accent fill on a lighter track of the same hue. */
export function ScoreRing({ score, size = 64, label }: { score?: number; size?: number; label?: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = score === undefined ? 0 : Math.max(0, Math.min(100, score)) / 100;
  return (
    <div style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label ?? 'Score'}: ${score ?? 'keine Daten'}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent-soft)" strokeWidth={6} />
        {score !== undefined && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.3} fontWeight={650} fill="var(--text)">
          {score ?? '–'}
        </text>
      </svg>
      {label && <div className="ring-label">{label}</div>}
    </div>
  );
}

export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="switch">
      <span className="grow">
        <span>{label}</span>
        {hint && <span className="muted small" style={{ display: 'block' }}>{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2>{title}</h2>
          <button className="btn ghost" onClick={onClose}>
            Schließen
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

let toastListener: ((msg: string) => void) | null = null;

export function toast(msg: string): void {
  toastListener?.(msg);
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    toastListener = (m) => {
      setMsg(m);
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 3800);
    };
    return () => {
      toastListener = null;
      clearTimeout(timer);
    };
  }, []);
  return msg ? (
    <div className="toast" role="status" onClick={() => setMsg(null)}>
      {msg}
    </div>
  ) : null;
}

/** Runs an async action with busy state and error toast. */
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message || 'Etwas ist schiefgelaufen.');
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="stack" style={{ textAlign: 'center', padding: '8px 4px' }}>
      <div className="muted small">{children}</div>
      {action}
    </div>
  );
}
