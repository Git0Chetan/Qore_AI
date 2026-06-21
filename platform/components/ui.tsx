import type { ApplicationStatus } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';
import { statusColor } from '@/lib/utils';

export function Card({
  children,
  className = '',
  hover = false,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`ui-card${hover ? ' ui-card-hover' : ''} ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  type = 'button',
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <button type={type} className={`ui-btn ui-btn-${variant} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 6,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
      {children}
      {hint && (
        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-faint)', marginTop: 5 }}>
          {hint}
        </span>
      )}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props;
  return <input className={`ui-input ${className}`} {...rest} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', style, ...rest } = props;
  return (
    <textarea
      className={`ui-input ${className}`}
      style={{ minHeight: 90, resize: 'vertical', ...style }}
      {...rest}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', ...rest } = props;
  return <select className={`ui-input ${className}`} {...rest} />;
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const c = statusColor(status);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 600,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.fg}33`,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 9999, background: c.fg }} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PageShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="ui-fade-in" style={{ maxWidth: 1140, margin: '0 auto', padding: '40px 24px 64px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 28,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0, color: 'var(--text)' }}>{title}</h1>
          {subtitle && (
            <p style={{ color: 'var(--text-muted)', margin: '8px 0 0', fontSize: 15 }}>{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
