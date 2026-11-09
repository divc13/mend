import { readFileSync } from 'node:fs';
import { MendError, bidCommitmentHash } from '@mend/protocol';
import type { BidCommitmentInput } from '@mend/protocol';
import { CONTRACTOR_STRATEGIES } from './strategies.js';

export type LiveStrategyKey = 'A' | 'B' | 'C';

/** Live testnet sub-accounts. Kept separate from the fictional fixture accounts. */
export const LIVE_CONTRACTOR_ACCOUNTS: Readonly<Record<LiveStrategyKey, string>> = {
  A: 'mend-contractor-a.testnet',
  B: 'mend-contractor-b.testnet',
  C: 'mend-contractor-c.testnet',
};

export const LIVE_HUB_ACCOUNT = 'mend-hub.testnet';
const ACCOUNT_PATTERN = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

export type EnvLike = Record<string, string | undefined>;

export interface ContractorLiveConfig {
  network: 'testnet';
  hubAccount: string;
  /** Path to an external key file. Never a secret value and never committed. */
  keyPath: string | null;
  strategy: LiveStrategyKey;
  accounts: Readonly<Record<LiveStrategyKey, string>>;
  /** Account for the configured strategy. */
  accountId: string;
}

function accountOrThrow(value: string, label: string): string {
  if (!ACCOUNT_PATTERN.test(value) || value.length < 2 || value.length > 64) {
    throw new MendError('VALIDATION_ERROR', `invalid ${label} account: ${value}`);
  }
  return value;
}

/**
 * Reads live configuration from env. Account IDs may be overridden per strategy,
 * but only the path to key material is accepted: no secret is read from env.
 */
export function loadContractorLiveConfig(env: EnvLike = process.env): ContractorLiveConfig {
  const network = env.MEND_NEAR_NETWORK ?? 'testnet';
  if (network !== 'testnet') {
    throw new MendError('FORBIDDEN_ROLE', 'contractor live mode is testnet-only');
  }
  const hubAccount = accountOrThrow(env.MEND_HUB_ACCOUNT ?? LIVE_HUB_ACCOUNT, 'hub');
  const strategy = (env.MEND_CONTRACTOR_STRATEGY ?? 'A') as LiveStrategyKey;
  if (!(strategy in LIVE_CONTRACTOR_ACCOUNTS)) {
    throw new MendError('VALIDATION_ERROR', `live contractor strategy must be A, B or C: ${String(strategy)}`);
  }
  const accounts: Record<LiveStrategyKey, string> = {
    A: accountOrThrow(env.MEND_CONTRACTOR_ACCOUNT_A ?? LIVE_CONTRACTOR_ACCOUNTS.A, 'contractor A'),
    B: accountOrThrow(env.MEND_CONTRACTOR_ACCOUNT_B ?? LIVE_CONTRACTOR_ACCOUNTS.B, 'contractor B'),
    C: accountOrThrow(env.MEND_CONTRACTOR_ACCOUNT_C ?? LIVE_CONTRACTOR_ACCOUNTS.C, 'contractor C'),
  };
  const override = env.MEND_CONTRACTOR_ACCOUNT;
  if (override !== undefined) {
    accounts[strategy] = accountOrThrow(override, 'contractor');
  }
  const keyPath = env.MEND_CONTRACTOR_KEY_PATH ?? null;
  if (keyPath !== null && keyPath.trim().length === 0) {
    throw new MendError('VALIDATION_ERROR', 'MEND_CONTRACTOR_KEY_PATH must not be empty');
  }
  return {
    network: 'testnet',
    hubAccount,
    keyPath,
    strategy,
    accounts,
    accountId: accounts[strategy],
  };
}

/** Safe for logs: excludes all key material by construction. */
export function redactContractorLiveConfig(config: ContractorLiveConfig): Omit<ContractorLiveConfig, never> {
  return { ...config };
}

export interface ContractorKeyMaterial {
  accountId: string;
  publicKey: string | null;
  secretKey: string;
}

interface KeyFileEntry {
  account?: string;
  accountId?: string;
  account_id?: string;
  publicKey?: string;
  public_key?: string;
  secretKey?: string;
  secret_key?: string;
  role?: string;
}

function entryFor(parsed: unknown, accountId: string): KeyFileEntry | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;
  const scopedAccounts = record.accounts;
  const map = scopedAccounts && typeof scopedAccounts === 'object' ? (scopedAccounts as Record<string, unknown>) : record;
  const direct = map[accountId];
  if (direct && typeof direct === 'object') return direct as KeyFileEntry;
  if (
    (record.accountId === accountId || record.account === accountId || record.account_id === accountId) &&
    (record.secretKey || record.secret_key)
  ) {
    return record as KeyFileEntry;
  }
  return null;
}

/**
 * Loads one scoped key from an external JSON file. Accepts either a flat
 * `{ accountId, secretKey }` record, the operator `keys.json` map, or the
 * `{ accounts: { [accountId]: ... } }` scoped-key map. The secret is returned
 * to the caller only; it is never logged or included in an error.
 */
export function readContractorKeyMaterial(
  keyPath: string,
  accountId: string,
  readFile: (path: string, encoding: 'utf8') => string = readFileSync,
): ContractorKeyMaterial {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFile(keyPath, 'utf8')) as unknown;
  } catch {
    throw new MendError('VALIDATION_ERROR', `cannot read contractor key file for ${accountId}`, { keyPath });
  }
  const entry = entryFor(parsed, accountId);
  if (!entry) {
    throw new MendError('VALIDATION_ERROR', `key file has no entry for ${accountId}`, { keyPath });
  }
  const secretKey = entry.secretKey ?? entry.secret_key;
  if (typeof secretKey !== 'string' || secretKey.length === 0) {
    throw new MendError('VALIDATION_ERROR', `key file entry for ${accountId} has no secret key`, { keyPath });
  }
  const publicKey = entry.publicKey ?? entry.public_key ?? null;
  return { accountId, publicKey: typeof publicKey === 'string' ? publicKey : null, secretKey };
}

export interface LiveBidPlan {
  strategy: LiveStrategyKey;
  accountId: string;
  bid: BidCommitmentInput;
  commitmentHash: string;
  commit: {
    method: 'commit_bid';
    args: { work_order_id: string; bid_id: string; commitment_hash: string };
  };
  reveal: {
    method: 'reveal_bid';
    args: {
      work_order_id: string;
      bid_id: string;
      price: string;
      duration_days: number;
      warranty_days: number;
      materials_score: number;
      available_in_days: number;
      checklist_accepted: boolean;
      nonce: string;
    };
  };
}

/**
 * Rebinds a frozen canonical strategy to its live testnet account and returns
 * the exact contract payloads. The account is committed, so the live hash
 * differs from the fictional fixture hash by design and remains deterministic.
 */
export function buildLiveBidPlan(
  key: LiveStrategyKey,
  workOrderId: string,
  accountId: string,
): LiveBidPlan {
  if (workOrderId.trim().length === 0) {
    throw new MendError('VALIDATION_ERROR', 'work order id is required');
  }
  const strategy = CONTRACTOR_STRATEGIES[key];
  if (!strategy.canonical) {
    throw new MendError('VALIDATION_ERROR', `${key} is not a canonical A/B/C strategy`);
  }
  const bid: BidCommitmentInput = { ...strategy.bid, contractorId: accountId };
  const commitmentHash = bidCommitmentHash(bid);
  return {
    strategy: key,
    accountId,
    bid,
    commitmentHash,
    commit: {
      method: 'commit_bid',
      args: { work_order_id: workOrderId, bid_id: bid.bidId, commitment_hash: commitmentHash },
    },
    reveal: {
      method: 'reveal_bid',
      args: {
        work_order_id: workOrderId,
        bid_id: bid.bidId,
        price: bid.priceMicro,
        duration_days: bid.durationDays,
        warranty_days: bid.warrantyDays,
        materials_score: bid.materialsScore,
        available_in_days: bid.availableInDays,
        checklist_accepted: bid.evidenceChecklistAccepted,
        nonce: bid.nonce,
      },
    },
  };
}

/** The three canonical bids, rebound to the configured live accounts. */
export function buildCanonicalLiveBidPlans(options: {
  workOrderId: string;
  accounts?: Partial<Record<LiveStrategyKey, string>>;
}): LiveBidPlan[] {
  return (['A', 'B', 'C'] as const).map((key) =>
    buildLiveBidPlan(key, options.workOrderId, options.accounts?.[key] ?? LIVE_CONTRACTOR_ACCOUNTS[key]),
  );
}
