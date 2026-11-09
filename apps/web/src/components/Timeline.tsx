import type { ReactNode } from 'react';
import type { TimelineEvent } from '@/lib/types';
import { formatDateTime, shortHash } from '@/lib/format';
import {
  AlertTriangle,
  Camera,
  Check,
  Coins,
  Eye,
  FileText,
  Gavel,
  Hammer,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
} from './Icons';

const kindMeta: Record<TimelineEvent['kind'], { label: string; icon: ReactNode }> = {
  report: { label: 'Report', icon: <Camera size={16} /> },
  triage: { label: 'Triage', icon: <Sparkles size={16} /> },
  policy: { label: 'Authorization', icon: <FileText size={16} /> },
  funding: { label: 'Funding', icon: <Coins size={16} /> },
  bid: { label: 'Sealed bids', icon: <ShieldCheck size={16} /> },
  score: { label: 'Deterministic score', icon: <Scale size={16} /> },
  award: { label: 'Award', icon: <Gavel size={16} /> },
  work: { label: 'Work', icon: <Hammer size={16} /> },
  evidence: { label: 'Evidence', icon: <FileText size={16} /> },
  inspection: { label: 'Inspection', icon: <Users size={16} /> },
  payment: { label: 'Payment', icon: <Coins size={16} /> },
  warranty: { label: 'Warranty', icon: <AlertTriangle size={16} /> },
  dispute: { label: 'Dispute', icon: <AlertTriangle size={16} /> },
  close: { label: 'Closed', icon: <Check size={16} /> },
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="timeline" aria-label="Case timeline">
      {events.map((event, index) => {
        const meta = kindMeta[event.kind];
        return (
          <li key={event.id} className="timeline__item">
            <div className="timeline__rail" aria-hidden="true">
              <span className="timeline__dot">{meta.icon}</span>
              {index < events.length - 1 ? <span className="timeline__line" /> : null}
            </div>
            <div className="timeline__body">
              <div className="timeline__meta">
                <span className="timeline__kind">{meta.label}</span>
                <time dateTime={event.at}>{formatDateTime(event.at)}</time>
              </div>
              <h3>{event.title}</h3>
              <p>{event.detail}</p>
              <p className="timeline__actor">{event.actor}</p>
              {event.evidence && event.evidence.length > 0 ? (
                <ul className="evidence-chips" aria-label="Evidence references">
                  {event.evidence.map((evidence, evidenceIndex) => (
                    <li key={`${event.id}-${evidenceIndex}`} className={`evidence-chip evidence-chip--${evidence.kind.toLowerCase()}`}>
                      {evidence.kind === 'HASH' ? <FileText size={13} aria-hidden="true" /> : null}
                      {evidence.kind === 'HUMAN' ? <Users size={13} aria-hidden="true" /> : null}
                      {evidence.kind === 'PHYSICAL' ? <Eye size={13} aria-hidden="true" /> : null}
                      {evidence.kind === 'TX' ? <AlertTriangle size={13} aria-hidden="true" /> : null}
                      {evidence.kind === 'ATTESTATION' ? <ShieldCheck size={13} aria-hidden="true" /> : null}
                      <span>{evidence.label}</span>
                      {evidence.value ? (
                        <code title={evidence.value}>
                          {evidence.kind === 'HASH' && evidence.value.length > 28
                            ? shortHash(evidence.value, 10, 6)
                            : evidence.value}
                        </code>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
