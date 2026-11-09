'use client';

import { useEffect, useState } from 'react';
import { formatDateTime } from '@/lib/format';
import type { CaseBundle } from '@/lib/types';
import { AlertTriangle, Check, Clock } from './Icons';

function remainingText(target: string, now: number): string {
  const diff = new Date(target).getTime() - now;
  if (Number.isNaN(diff)) return 'Timestamp unavailable';
  if (diff <= 0) return 'Window elapsed — inspection decision pending';
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m ${totalSeconds % 60}s remaining`;
}

export function WarrantyCountdown({ caseData }: { caseData: CaseBundle }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  if (caseData.warranty?.state === 'OPEN' || caseData.warranty?.state === 'REMEDIATING') {
    return (
      <div className="warranty-card warranty-card--warning">
        <span className="warranty-card__icon">
          <AlertTriangle size={18} />
        </span>
        <div>
          <p className="warranty-card__label">Warranty case {caseData.warranty.id}</p>
          <p className="warranty-card__value">{caseData.warranty.state === 'OPEN' ? 'Open' : 'Remediation in progress'}</p>
          <p className="warranty-card__note">{caseData.warranty.note}</p>
          <p className="warranty-card__time">Opened {formatDateTime(caseData.warranty.openedAt)}</p>
        </div>
      </div>
    );
  }

  if (caseData.status === 'CLOSED') {
    return (
      <div className="warranty-card warranty-card--positive">
        <span className="warranty-card__icon">
          <Check size={18} />
        </span>
        <div>
          <p className="warranty-card__label">Durability</p>
          <p className="warranty-card__value">Holdback released</p>
          <p className="warranty-card__note">Durability inspection passed. No repeat failure recorded.</p>
          {caseData.durabilityDueAt ? (
            <p className="warranty-card__time">Due {formatDateTime(caseData.durabilityDueAt)}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (!caseData.durabilityDueAt) {
    return (
      <div className="warranty-card">
        <span className="warranty-card__icon">
          <Clock size={18} />
        </span>
        <div>
          <p className="warranty-card__label">Durability</p>
          <p className="warranty-card__value">Not started</p>
          <p className="warranty-card__note">The durability window begins only after independent completion acceptance.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="warranty-card">
      <span className="warranty-card__icon">
        <Clock size={18} />
      </span>
      <div>
        <p className="warranty-card__label">Durability window</p>
        <p className="warranty-card__value">{now === null ? 'Checking fixed deadline…' : remainingText(caseData.durabilityDueAt, now)}</p>
        <p className="warranty-card__note">
          Predetermined at acceptance. Demo interval is 2 minutes, configured explicitly — not a hidden admin control.
        </p>
        <p className="warranty-card__time">Due {formatDateTime(caseData.durabilityDueAt)}</p>
      </div>
    </div>
  );
}
