import {
  MAINNET_LABEL,
  REPLAY_LABEL,
  TESTNET_LABEL,
  WORK_ORDER_MODES,
  type WorkOrderMode,
} from '@mend/protocol';

/** The three explicitly labelled MEND operating modes. */
export const MEND_MODES = WORK_ORDER_MODES;
export type MendMode = WorkOrderMode;

export const MODE_LABELS: Readonly<Record<MendMode, string>> = Object.freeze({
  LIVE_TESTNET: TESTNET_LABEL,
  MAINNET: MAINNET_LABEL,
  REPLAY: REPLAY_LABEL,
});

export function modeLabel(mode: MendMode): string {
  const label = MODE_LABELS[mode];
  if (!label) throw new Error(`unknown MEND mode: ${String(mode)}`);
  return label;
}

export function isMainnetMode(mode: MendMode): boolean {
  return mode === 'MAINNET';
}
