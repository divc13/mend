import type { Mode } from './types';

export const MODE_META: Record<
  Mode,
  { label: string; short: string; description: string; tone: 'replay' | 'live' | 'mainnet'; selectable: boolean }
> = {
  REPLAY: {
    label: 'REPLAY / SIMULATION',
    short: 'Replay',
    description: 'Frozen protocol fixtures. No live transaction, AI attestation or physical verification is claimed.',
    tone: 'replay',
    selectable: true,
  },
  LIVE_TESTNET: {
    label: 'LIVE TESTNET — TEST VALUE ONLY',
    short: 'Live testnet',
    description: 'Connected to the testnet API and hub. Tokens have no real value. Transactions must be real hashes.',
    tone: 'live',
    selectable: true,
  },
  MAINNET: {
    label: 'MAINNET — REAL FUNDS',
    short: 'Mainnet',
    description: 'Never selectable from this demo UI. A separate explicit human approval is required for every mainnet action.',
    tone: 'mainnet',
    selectable: false,
  },
};

export function isMode(value: string | null | undefined): value is Mode {
  return value === 'LIVE_TESTNET' || value === 'MAINNET' || value === 'REPLAY';
}

export function safeMode(value: string | null | undefined): Mode {
  if (value === 'LIVE_TESTNET' || value === 'MAINNET') return value;
  return 'REPLAY';
}
