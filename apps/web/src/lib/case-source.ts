import type { Mode } from './types';

/**
 * Labels for public case data. `api` means the record was read from the
 * configured MEND API; `fixture` means the frozen replay recording is shown.
 *
 * The API can legitimately return a record whose own mode is REPLAY. That is
 * still live API data, but it is a replay record and must not be labelled as a
 * live testnet transaction record.
 */
export type CaseDataSource = 'api' | 'fixture';

export type CaseSourceTone = 'positive' | 'warning' | 'neutral';

export function caseSourceLabel(
  source: CaseDataSource,
  mode: Mode | undefined,
  apiConfigured = false,
): string {
  if (source === 'api') {
    if (mode === 'REPLAY') return 'LIVE API · REPLAY RECORD';
    if (mode === 'MAINNET') return 'LIVE API · MAINNET';
    return 'LIVE API · TESTNET';
  }
  return apiConfigured ? 'REPLAY / SIMULATION · FIXTURE FALLBACK' : 'REPLAY / SIMULATION';
}

export function caseSourceTone(source: CaseDataSource, mode: Mode | undefined): CaseSourceTone {
  if (source !== 'api') return 'warning';
  return mode === 'REPLAY' ? 'neutral' : 'positive';
}
