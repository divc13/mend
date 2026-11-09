import type { MendMode } from './mode.js';

export type MainnetGuardCode = 'MAINNET_NOT_ALLOWED';

export class MainnetGuardError extends Error {
  readonly code: MainnetGuardCode = 'MAINNET_NOT_ALLOWED';

  constructor(message: string) {
    super(message);
    this.name = 'MainnetGuardError';
  }
}

/**
 * Two independent human signals are required before any MAINNET action:
 * an explicit approval (for the configured operation) and a human confirmation.
 * Both must be the boolean `true`; truthy values do not count. The guard fails
 * closed for every other combination, including malformed input.
 */
export interface MainnetApproval {
  explicitApproval: boolean;
  humanConfirmed: boolean;
}

export const NO_MAINNET_APPROVAL: Readonly<MainnetApproval> = Object.freeze({
  explicitApproval: false,
  humanConfirmed: false,
});

export function assertMainnetAllowed(approval: MainnetApproval): void {
  const explicit = approval?.explicitApproval === true;
  const human = approval?.humanConfirmed === true;
  if (!explicit || !human) {
    const missing = [
      explicit ? undefined : 'explicitApproval',
      human ? undefined : 'humanConfirmed',
    ].filter((value): value is string => Boolean(value));
    throw new MainnetGuardError(
      `MAINNET requires explicit human approval; missing: ${missing.join(', ')}`,
    );
  }
}

/**
 * REPLAY and LIVE_TESTNET are unaffected by the mainnet gate. MAINNET is always
 * routed through `assertMainnetAllowed` and can never be granted implicitly.
 */
export function assertModeAllowed(mode: MendMode, approval: MainnetApproval = NO_MAINNET_APPROVAL): void {
  if (mode === 'MAINNET') assertMainnetAllowed(approval);
}
