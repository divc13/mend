import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { Account, JsonRpcProvider, KeyPairSigner, actions } from 'near-api-js';
import type { KeyPairSigner as NearKeyPairSigner } from 'near-api-js';
import { sha256Hex } from '@mend/protocol';
import type { AppConfig } from '../config.js';

export const TESTNET_EXPLORER_BASE = 'https://explorer.testnet.near.org/transactions/';
export const DEFAULT_TESTNET_RPC = 'https://rpc.testnet.near.org';
export const TGAS = 1_000_000_000_000n;

export type TestnetRole = 'deployer' | 'steward' | 'sponsor' | 'dao' | 'contractor' | 'inspector' | 'admin';

interface KeyFileEntry {
  account?: unknown;
  secretKey?: unknown;
  publicKey?: unknown;
  network?: unknown;
}

interface LoadedKey {
  accountId: string;
  publicKey?: string;
  signer: NearKeyPairSigner;
}

/** A signer is missing for a configured role account. Never includes secret material. */
export class MissingTestnetSignerError extends Error {
  constructor(readonly accountId: string, readonly role?: TestnetRole) {
    super(
      `No testnet signing key for ${accountId}${role ? ` (role ${role})` : ''}. Add the account to MEND_TESTNET_KEYS_FILE outside the repository.`,
    );
    this.name = 'MissingTestnetSignerError';
  }
}

/** A transaction was included but the chain reported Failure. */
export class LiveChainTxFailure extends Error {
  constructor(message: string, readonly txHash?: string) {
    super(message);
    this.name = 'LiveChainTxFailure';
  }
}

/**
 * Runtime key loader. The JSON file is read from a human-managed path outside
 * the repository. Secret keys only ever live in memory as KeyPairSigner
 * instances; errors and diagnostics expose account ids only.
 */
export class TestnetKeyStore {
  private loaded = false;
  private keys = new Map<string, LoadedKey>();
  private lastMtimeMs = -1;
  private loadError?: string;

  constructor(private readonly filePath: string | undefined) {}

  get available(): boolean {
    this.ensureLoaded();
    return this.keys.size > 0;
  }

  get unavailableReason(): string | undefined {
    if (!this.filePath) {
      return 'MEND_TESTNET_KEYS_FILE is not set. Testnet signing keys must live outside the repository.';
    }
    this.ensureLoaded();
    return this.loadError;
  }

  has(accountId: string): boolean {
    this.ensureLoaded();
    return this.keys.has(accountId);
  }

  accountIds(): string[] {
    this.ensureLoaded();
    return [...this.keys.keys()].sort();
  }

  publicKeyFor(accountId: string): string | undefined {
    this.ensureLoaded();
    return this.keys.get(accountId)?.publicKey;
  }

  signerFor(accountId: string, role?: TestnetRole): NearKeyPairSigner {
    this.ensureLoaded();
    const entry = this.keys.get(accountId);
    if (!entry) throw new MissingTestnetSignerError(accountId, role);
    return entry.signer;
  }

  private ensureLoaded(): void {
    if (!this.filePath) return;
    if (!keyFileIsOutsideRepository(this.filePath)) {
      this.loaded = true;
      this.loadError = 'MEND_TESTNET_KEYS_FILE resolves inside the repository. Move it outside the repo and set the absolute path again.';
      return;
    }
    let mtimeMs: number;
    try {
      mtimeMs = statSync(this.filePath).mtimeMs;
    } catch {
      this.loaded = true;
      this.loadError = 'MEND_TESTNET_KEYS_FILE could not be read. Check that the human-managed file exists and is readable.';
      return;
    }
    if (this.loaded && mtimeMs === this.lastMtimeMs) return;
    this.loaded = true;
    this.lastMtimeMs = mtimeMs;
    this.loadError = undefined;
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Record<string, KeyFileEntry>;
      const next = new Map<string, LoadedKey>();
      for (const [key, raw] of Object.entries(parsed ?? {})) {
        if (!raw || typeof raw !== 'object') continue;
        const accountId = typeof raw.account === 'string' && raw.account.length > 0 ? raw.account : key;
        const secretKey = raw.secretKey;
        if (typeof secretKey !== 'string' || !secretKey.startsWith('ed25519:')) continue;
        if (raw.network !== undefined && raw.network !== 'testnet') continue;
        try {
          next.set(accountId, {
            accountId,
            signer: KeyPairSigner.fromSecretKey(secretKey as never),
            ...(typeof raw.publicKey === 'string' ? { publicKey: raw.publicKey } : {}),
          });
        } catch {
          // A malformed entry is ignored; its contents are never surfaced.
        }
      }
      this.keys = next;
      if (next.size === 0) {
        this.loadError = 'MEND_TESTNET_KEYS_FILE contains no usable testnet signing keys.';
      }
    } catch {
      this.keys = new Map();
      this.loadError = 'MEND_TESTNET_KEYS_FILE is not valid JSON. It was not logged; fix the file permissions/content manually.';
    }
  }
}

export interface LiveChainTx {
  txHash: string;
  explorerUrl: string;
  signer: string;
  receiver: string;
  method: string;
  realTransaction: true;
}

export interface LiveChainCallOptions {
  deposit?: bigint;
  gas?: bigint;
}

export interface SignerDirectory {
  has(accountId: string): boolean;
  accountIds(): string[];
}

export interface LiveChainExecutor {
  readonly available: boolean;
  readonly unavailableReason?: string;
  readonly network: 'testnet';
  readonly hubAccount: string;
  readonly tokenAccount: string;
  readonly keys: SignerDirectory;
  call(
    signerAccountId: string,
    receiverId: string,
    method: string,
    args: Record<string, unknown>,
    options?: LiveChainCallOptions,
  ): Promise<LiveChainTx>;
  view<T = unknown>(receiverId: string, method: string, args: Record<string, unknown>): Promise<T>;
  accountExists(accountId: string): Promise<boolean>;
  ftBalance(accountId: string): Promise<string>;
  storageBalance(accountId: string): Promise<{ total: string; available: string } | null>;
  /**
   * Read the deployed hub code and report which bid-commitment payload it
   * verifies. Older testnet deployments verify MEND_BID_V1 while the current
   * protocol library hashes MEND_BID_V2. This prevents a live scenario from
   * committing a hash the deployed contract cannot reveal.
   */
  detectBidPayloadVersion?(): Promise<'v1' | 'v2' | undefined>;
}

/** JSON serializer that preserves u64 deadlines as exact integer literals. */
export function serializeChainArgs(value: unknown): string {
  if (typeof value === 'bigint') return value.toString();
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(serializeChainArgs).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.entries(record)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => `${JSON.stringify(key)}:${serializeChainArgs(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function txHashOf(response: unknown): string | undefined {
  const record = response as Record<string, any> | null;
  return record?.transaction?.hash ?? record?.transaction_outcome?.id ?? record?.transaction?.id;
}

function explorerUrl(txHash: string): string {
  return `${TESTNET_EXPLORER_BASE}${txHash}`;
}

/** Walk up to the repository root (.git file or directory). */
function repositoryRoot(start: string): string | undefined {
  let current = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

export function keyFileIsOutsideRepository(filePath: string): boolean {
  const root = repositoryRoot(path.dirname(path.resolve(filePath)));
  return !root || !path.resolve(filePath).startsWith(`${root}${path.sep}`);
}

/**
 * Real NEAR testnet transport. It never talks to mainnet: the RPC URL is
 * validated and the signer keys are only used for testnet accounts.
 */
export class NearLiveChain implements LiveChainExecutor {
  readonly network = 'testnet' as const;
  readonly hubAccount: string;
  readonly tokenAccount: string;
  readonly keys: TestnetKeyStore;
  readonly available: boolean;
  readonly unavailableReason?: string;
  private readonly provider: JsonRpcProvider;

  constructor(config: AppConfig['chain'], keys = new TestnetKeyStore(config.keysFile)) {
    this.hubAccount = config.hubAccount;
    this.tokenAccount = config.tokenAccount;
    this.keys = keys;
    const rpcUrl = config.rpcUrl ?? DEFAULT_TESTNET_RPC;
    const mainnet = /mainnet|near\.org\/?$|rpc\.near\.org/i.test(rpcUrl) && !/testnet/i.test(rpcUrl);
    this.available = config.network === 'testnet' && !mainnet && keys.available;
    this.unavailableReason = config.network !== 'testnet'
      ? 'The live adapter only signs NEAR testnet transactions. Mainnet is refused.'
      : mainnet
        ? 'MEND_RPC_URL appears to target mainnet. Only https://rpc.testnet.near.org is allowed.'
        : keys.unavailableReason;
    this.provider = new JsonRpcProvider({ url: rpcUrl });
  }

  async call(
    signerAccountId: string,
    receiverId: string,
    method: string,
    args: Record<string, unknown>,
    options: LiveChainCallOptions = {},
  ): Promise<LiveChainTx> {
    if (!this.available) {
      throw new Error(this.unavailableReason ?? 'Live testnet transport is unavailable');
    }
    const signer = this.keys.signerFor(signerAccountId);
    const account = new Account(signerAccountId, this.provider, signer);
    const response = await account.signAndSendTransaction({
      receiverId,
      actions: [actions.functionCall(
        method,
        Buffer.from(serializeChainArgs(args)),
        options.gas ?? 30n * TGAS,
        options.deposit ?? 0n,
      )],
      // Inspect the outcome ourselves so a failure keeps its tx hash and logs.
      throwOnFailure: false,
    });
    const txHash = txHashOf(response);
    if (!txHash) {
      throw new LiveChainTxFailure('RPC returned no transaction hash; the action is not confirmed.');
    }
    const status = (response as Record<string, any>).status;
    if (status && typeof status === 'object' && 'Failure' in status) {
      const failure = JSON.stringify(status.Failure ?? {}).replace(/ed25519:[A-Za-z0-9]+/g, 'ed25519:[redacted]');
      throw new LiveChainTxFailure(
        `NEAR transaction ${txHash} failed on chain: ${failure.slice(0, 600)}`,
        txHash,
      );
    }
    return {
      txHash,
      explorerUrl: explorerUrl(txHash),
      signer: signerAccountId,
      receiver: receiverId,
      method,
      realTransaction: true,
    };
  }

  async view<T = unknown>(receiverId: string, method: string, args: Record<string, unknown>): Promise<T> {
    if (!this.available) {
      throw new Error(this.unavailableReason ?? 'Live testnet transport is unavailable');
    }
    // Some NEP-141 views (storage_balance_of) legitimately return JSON null.
    // RPC transport errors still reject; callers interpret null/undefined.
    const result = await this.provider.callFunction({
      contractId: receiverId,
      method,
      args,
    }) as unknown;
    return result as T;
  }

  async accountExists(accountId: string): Promise<boolean> {
    try {
      await this.provider.viewAccount({ accountId });
      return true;
    } catch {
      return false;
    }
  }

  async ftBalance(accountId: string): Promise<string> {
    const value = await this.view<unknown>(this.tokenAccount, 'ft_balance_of', { account_id: accountId });
    return typeof value === 'string' ? value : String(value ?? '0');
  }

  async storageBalance(accountId: string): Promise<{ total: string; available: string } | null> {
    const value = await this.view<Record<string, unknown> | null>(
      this.tokenAccount,
      'storage_balance_of',
      { account_id: accountId },
    );
    if (!value) return null;
    return {
      total: String(value.total ?? '0'),
      available: String(value.available ?? '0'),
    };
  }

  async detectBidPayloadVersion(): Promise<'v1' | 'v2' | undefined> {
    if (!this.available) return undefined;
    try {
      const view = await this.provider.viewContractCode({ contractId: this.hubAccount });
      const bytes = Buffer.from(view.code);
      const text = bytes.toString('latin1');
      if (text.includes('MEND_BID_V2|')) return 'v2';
      if (text.includes('MEND_BID_V1|')) return 'v1';
      return undefined;
    } catch {
      return undefined;
    }
  }
}

/** Hash any free-form reason into the contract's required 64 lowercase hex form. */
export function reasonHash(value: unknown, fallback: string): string {
  const text = typeof value === 'string' && value.length > 0 ? value : fallback;
  if (/^[a-f0-9]{64}$/.test(text)) return text;
  return sha256Hex(text);
}

export function explorerForTx(txHash: string): string {
  return explorerUrl(txHash);
}
