import type { ReactNode } from 'react';
import { statusTone } from '../lib/format.ts';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle !== undefined ? <p>{subtitle}</p> : null}
      </div>
      {actions !== undefined ? <div className="actions">{actions}</div> : null}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className === undefined ? 'card' : `card ${className}`}>
      {title !== undefined ? (
        <div className="card-head">
          <div>
            <h2>{title}</h2>
            {subtitle !== undefined ? <p>{subtitle}</p> : null}
          </div>
          {actions !== undefined ? <div className="actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint !== undefined ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const resolved = tone ?? 'info';
  return <span className={`badge badge-${resolved}`}>{children}</span>;
}

export function StatusBadge({ status, label }: { status: string; label?: string | undefined }) {
  return <Badge tone={statusTone(status)}>{label ?? status}</Badge>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Notice({ tone, children }: { tone?: 'ok' | 'danger' | 'warn'; children: ReactNode }) {
  return <div className={`notice${tone === undefined ? '' : ` notice-${tone}`}`}>{children}</div>;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint !== undefined ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Table({ head, children }: { head: readonly string[]; children: ReactNode }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function KeyValue({ items }: { items: readonly { label: string; value: ReactNode }[] }) {
  return (
    <div className="stack">
      {items.map((item) => (
        <div className="spread" key={item.label}>
          <span className="muted small">{item.label}</span>
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  );
}
