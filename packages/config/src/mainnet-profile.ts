import {
  assertMainnetAllowed,
  NO_MAINNET_APPROVAL,
  type MainnetApproval,
} from './mainnet.js';

/**
 * Explicit marker for configuration values that must be supplied by a human.
 * These values are never guessed, defaulted or derived from another network.
 */
export const HUMAN_SUPPLIED = 'HUMAN_SUPPLIED' as const;
export type HumanSupplied = typeof HUMAN_SUPPLIED;

export const NEAR_MAINNET_EXPLORER = 'https://nearblocks.io' as const;

/**
 * Verified NEAR mainnet USDC (NEP-141) token contract.
 *
 * Verification: `ft_metadata` against https://rpc.mainnet.near.org on
 * 2026-11-09 returned symbol `USDC` and decimals `6` for this account.
 */
export const NEAR_MAINNET_USDC_ACCOUNT =
  '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1' as const;
export const NEAR_MAINNET_USDC_SOURCE_URL = 'https://rpc.mainnet.near.org' as const;
export const NEAR_MAINNET_USDC_VERIFIED_AT = '2026-11-09' as const;

export interface MainnetTokenMetadata {
  readonly account: string;
  readonly symbol: string;
  readonly decimals: number;
  readonly standard: 'NEP-141';
  readonly source: {
    readonly url: string;
    readonly method: 'ft_metadata';
    readonly verifiedAt: string;
  };
}

/** Frozen so runtime code cannot substitute a different token or precision. */
export const NEAR_MAINNET_USDC: MainnetTokenMetadata = Object.freeze({
  account: NEAR_MAINNET_USDC_ACCOUNT,
  symbol: 'USDC',
  decimals: 6,
  standard: 'NEP-141',
  source: Object.freeze({
    url: NEAR_MAINNET_USDC_SOURCE_URL,
    method: 'ft_metadata',
    verifiedAt: NEAR_MAINNET_USDC_VERIFIED_AT,
  }),
});

export interface MainnetProfile {
  readonly network: 'near-mainnet';
  /** Human-supplied hub account; never inferred from testnet or replay data. */
  readonly hubAccount: string;
  /** Human-supplied sponsor account; never inferred. */
  readonly sponsorAccount: string;
  /** Human-supplied RPC endpoint; never inferred. */
  readonly rpcUrl: string;
  readonly usdc: MainnetTokenMetadata;
  readonly approval: MainnetApproval;
}

/**
 * The only mainnet profile this package ships. It is deliberately a draft:
 * every operator-controlled field and both approval signals are unresolved,
 * so `assertMainnetProfileReady` fails closed. It is never selected by
 * `loadConfig` and must be imported explicitly.
 *
 * The USDC metadata is the sole verified value; it is not an operator value.
 */
export const MAINNET_PROFILE_DRAFT: MainnetProfile = Object.freeze({
  network: 'near-mainnet',
  hubAccount: HUMAN_SUPPLIED,
  sponsorAccount: HUMAN_SUPPLIED,
  rpcUrl: HUMAN_SUPPLIED,
  usdc: NEAR_MAINNET_USDC,
  approval: NO_MAINNET_APPROVAL,
});

export type MainnetProfileField = 'hubAccount' | 'sponsorAccount' | 'rpcUrl';

export class MainnetProfileError extends Error {
  readonly code = 'MAINNET_PROFILE_NOT_READY' as const;
  readonly missing: readonly MainnetProfileField[];

  constructor(missing: readonly MainnetProfileField[]) {
    super(
      `MAINNET profile is not ready; human-supplied values required: ${missing.join(', ')}`,
    );
    this.name = 'MainnetProfileError';
    this.missing = Object.freeze([...missing]);
  }
}

export class MainnetInputError extends Error {
  readonly code = 'INVALID_MAINNET_INPUT' as const;

  constructor(message: string) {
    super(message);
    this.name = 'MainnetInputError';
  }
}

function isSupplied(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim() !== HUMAN_SUPPLIED
  );
}

function requireNonBlank(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MainnetInputError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

/** Lists the operator values that are still placeholders or blank. */
export function missingMainnetProfileFields(profile: MainnetProfile): MainnetProfileField[] {
  const missing: MainnetProfileField[] = [];
  if (!isSupplied(profile?.hubAccount)) missing.push('hubAccount');
  if (!isSupplied(profile?.sponsorAccount)) missing.push('sponsorAccount');
  if (!isSupplied(profile?.rpcUrl)) missing.push('rpcUrl');
  return missing;
}

/**
 * Fails closed unless the canonical mainnet approval guard passes *and* every
 * human-supplied field has been filled. Missing approval throws
 * `MainnetGuardError`; missing operator values throw `MainnetProfileError`.
 */
export function assertMainnetProfileReady(profile: MainnetProfile): void {
  const approval = (profile as Partial<MainnetProfile> | null | undefined)?.approval;
  assertMainnetAllowed(approval ?? NO_MAINNET_APPROVAL);

  const missing = missingMainnetProfileFields(profile);
  if (missing.length > 0) throw new MainnetProfileError(missing);

  const rpcUrl = profile.rpcUrl;
  try {
    const parsed = new URL(rpcUrl);
    if (parsed.protocol !== 'https:' || parsed.username !== '' || parsed.password !== '') {
      throw new MainnetInputError('rpcUrl must be an https URL without embedded credentials');
    }
  } catch (error) {
    if (error instanceof MainnetInputError) throw error;
    throw new MainnetInputError('rpcUrl must be a valid https URL');
  }
}

export interface MainnetProfileInput {
  hubAccount: string;
  sponsorAccount: string;
  rpcUrl: string;
  approval: MainnetApproval;
}

/**
 * Builds a ready mainnet profile from explicit human input. The returned value
 * is deeply frozen and always uses the verified mainnet USDC metadata.
 */
export function createMainnetProfile(input: MainnetProfileInput): MainnetProfile {
  const profile: MainnetProfile = Object.freeze({
    network: 'near-mainnet',
    hubAccount: requireNonBlank(input.hubAccount, 'hubAccount'),
    sponsorAccount: requireNonBlank(input.sponsorAccount, 'sponsorAccount'),
    rpcUrl: requireNonBlank(input.rpcUrl, 'rpcUrl'),
    usdc: NEAR_MAINNET_USDC,
    approval: Object.freeze({
      explicitApproval: input.approval?.explicitApproval === true,
      humanConfirmed: input.approval?.humanConfirmed === true,
    }),
  });
  assertMainnetProfileReady(profile);
  return profile;
}

function explorerSegment(value: string, label: string): string {
  return encodeURIComponent(requireNonBlank(value, label));
}

/** NEAR mainnet account page (nearblocks.io). */
export function buildMainnetAccountUrl(account: string): string {
  return `${NEAR_MAINNET_EXPLORER}/address/${explorerSegment(account, 'account')}`;
}

/** NEAR mainnet transaction page (nearblocks.io). */
export function buildMainnetTxUrl(txHash: string): string {
  return `${NEAR_MAINNET_EXPLORER}/txns/${explorerSegment(txHash, 'txHash')}`;
}
