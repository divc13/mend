'use client';

import { useMode } from './ModeProvider';
import { MODE_META } from '@/lib/modes';
import { AlertTriangle, Info } from './Icons';

export function DataSourceNote({
  source = 'fixture',
  detail,
}: {
  source?: 'fixture' | 'api';
  detail?: string;
}) {
  const { mode, apiConfigured } = useMode();

  if (source === 'api' && mode !== 'REPLAY') {
    return (
      <p className="source-note source-note--live">
        <Info size={16} />
        <span>Data source: live {MODE_META[mode].short} API. Only real transaction hashes receive explorer links.</span>
      </p>
    );
  }

  if (source === 'fixture' && mode !== 'REPLAY') {
    return (
      <p className="source-note source-note--replay">
        <AlertTriangle size={16} />
        <span>
          <strong>API data unavailable.</strong>{' '}
          {MODE_META[mode].label} is selected, but the API did not return usable data. Frozen replay fixtures are shown
          instead; no live transaction or attestation is claimed.
        </span>
      </p>
    );
  }

  return (
    <p className="source-note source-note--replay">
      <AlertTriangle size={16} />
      <span>
        <strong>REPLAY / SIMULATION.</strong>{' '}
        {detail ??
          (apiConfigured
            ? 'Frozen protocol fixtures are shown because replay mode is selected.'
            : 'No MEND_API_BASE_URL is configured; frozen protocol fixtures are shown.')}
      </span>
    </p>
  );
}
