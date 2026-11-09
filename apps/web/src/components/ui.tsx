import type { ReactNode } from 'react';
import { statusLabel, statusTone } from '@/lib/fixtures';
import { shortHash } from '@/lib/format';
import type { WorkOrderState } from '@/lib/types';
import { CopyButton } from './CopyButton';
import { ShieldCheck, AlertTriangle, Eye, Users } from './Icons';

export type Tone = 'neutral' | 'positive' | 'active' | 'warning' | 'danger' | 'info';

export function Badge({
  tone = 'neutral',
  children,
  icon,
}: {
  tone?: Tone;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <span className={`badge badge--${tone}`}>
      {icon}
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: WorkOrderState }) {
  return <span className={`status-pill status-pill--${statusTone(status)}`}>{statusLabel(status)}</span>;
}

export function SectionHead({
  id,
  eyebrow,
  title,
  lead,
  action,
  align = 'left',
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
  align?: 'left' | 'center';
}) {
  return (
    <div className={`section-head section-head--${align}`}>
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 id={id} className="section-title">
          {title}
        </h2>
        {lead ? <p className="section-lead">{lead}</p> : null}
      </div>
      {action ? <div className="section-action">{action}</div> : null}
    </div>
  );
}

export function Metric({
  label,
  value,
  note,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className={`metric metric--${tone}`}>
      <p className="metric__label">{label}</p>
      <p className="metric__value">{value}</p>
      {note ? <p className="metric__note">{note}</p> : null}
    </div>
  );
}

export function HashDisplay({
  value,
  label,
  copy = true,
}: {
  value: string;
  label: string;
  copy?: boolean;
}) {
  return (
    <div className="hash-display">
      <span className="hash-display__label">{label}</span>
      <code title={value}>{shortHash(value)}</code>
      {copy ? <CopyButton value={value} label={`Copy ${label}`} /> : null}
    </div>
  );
}

export function EvidenceTag({
  kind,
}: {
  kind: 'VERIFIED' | 'UNAVAILABLE' | 'HUMAN' | 'PHYSICAL';
}) {
  const meta = {
    VERIFIED: { label: 'Verified inference evidence', tone: 'positive' as const, icon: <ShieldCheck size={14} /> },
    UNAVAILABLE: { label: 'Unavailable evidence', tone: 'warning' as const, icon: <AlertTriangle size={14} /> },
    HUMAN: { label: 'Human decision', tone: 'info' as const, icon: <Users size={14} /> },
    PHYSICAL: { label: 'Physical claim', tone: 'neutral' as const, icon: <Eye size={14} /> },
  }[kind];

  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Badge>
  );
}

export function KeyValue({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="key-value">
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{children}</dd>
    </div>
  );
}

export function Callout({
  tone = 'info',
  title,
  children,
  icon,
}: {
  tone?: Tone;
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className={`callout callout--${tone}`}>
      <div className="callout__icon" aria-hidden="true">
        {icon ?? <AlertTriangle size={18} />}
      </div>
      <div>
        <p className="callout__title">{title}</p>
        <div className="callout__body">{children}</div>
      </div>
    </div>
  );
}

export function Divider() {
  return <hr className="divider" />;
}

export function PageHero({
  eyebrow,
  title,
  lead,
  aside,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lead: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-hero">
      <div className="page-hero__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-lead">{lead}</p>
        {children}
      </div>
      {aside ? <div className="page-hero__aside">{aside}</div> : null}
    </header>
  );
}
