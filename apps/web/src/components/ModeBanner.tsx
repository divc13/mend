'use client';

import Link from 'next/link';
import { useMode } from './ModeProvider';
import { MODE_META } from '@/lib/modes';
import { Info } from './Icons';

export function ModeBanner() {
  const { mode, apiConfigured } = useMode();
  const meta = MODE_META[mode];

  return (
    <div
      className={`mode-banner mode-banner--${meta.tone}`}
      role="region"
      aria-label="Environment mode"
      data-testid="mode-badge"
    >
      <div className="mode-banner__inner">
        <p className="mode-banner__label">
          <span className="mode-banner__dot" aria-hidden="true" />
          <span>{meta.label}</span>
        </p>
        <p className="mode-banner__detail">{meta.description}</p>
        <Link className="mode-banner__link" href="/demo">
          <Info size={15} aria-hidden="true" />
          <span>{apiConfigured ? 'Mode & demo role' : 'Why replay?'}</span>
        </Link>
      </div>
    </div>
  );
}
