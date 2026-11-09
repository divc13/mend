import { MainnetGuardError } from './errors.js';

/** Persistent copy that must accompany every Intents surface. */
export const MAINNET_ONLY_LABEL = 'MAINNET ONLY — real funds. No testnet.' as const;

export type GuardEnv = Record<string, string | undefined>;

export interface MainnetGuardOptions {
  /** Dry quotes never touch mainnet execution and are always allowed. */
  dry: boolean;
  /** Explicit per-call human confirmation. Must be the boolean true. */
  confirmMainnet?: boolean;
  /** Defaults to process.env. */
  env?: GuardEnv;
}

/**
 * Non-dry quotes allocate a real mainnet deposit address. They are refused
 * unless BOTH conditions hold:
 *   1. MEND_ALLOW_MAINNET === 'true'
 *   2. confirmMainnet === true
 *
 * This module contains no signing or transaction-sending capability.
 */
export function assertMainnetExecutionAllowed(options: MainnetGuardOptions): void {
  if (options.dry) return;

  const env = options.env ?? process.env;
  const missing: ('MEND_ALLOW_MAINNET' | 'confirmMainnet')[] = [];
  if (env.MEND_ALLOW_MAINNET !== 'true') missing.push('MEND_ALLOW_MAINNET');
  if (options.confirmMainnet !== true) missing.push('confirmMainnet');

  if (missing.length > 0) throw new MainnetGuardError(missing);
}

export function isMainnetExecutionAllowed(options: MainnetGuardOptions): boolean {
  try {
    assertMainnetExecutionAllowed(options);
    return true;
  } catch {
    return false;
  }
}
