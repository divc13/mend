/**
 * Testnet boundary for the wallet and live-run surfaces.
 *
 * The backend contract is intentionally normalised here rather than in the
 * components: the testnet API may return camelCase, snake_case or a wrapped
 * `{ data: ... }` payload. Anything that cannot be proven to be a testnet
 * transaction is shown as "not reported" or "unverified" — never as a live
 * explorer link.
 *
 * SAFETY: a secret key may pass through `normalizeWallet` exactly once after
 * account creation. Components keep it in React state only. Nothing in this
 * module writes to localStorage, sessionStorage, cookies or IndexedDB.
 */

export const TESTNET_EXPLORER = 'https://explorer.testnet.near.org';
export const TESTNET_HUB_ACCOUNT = 'mend-hub-v2.testnet';
export const TESTNET_TOKEN_ACCOUNT = 'mend-usdc.testnet';
export const TESTNET_FAUCET_MICRO = '100000000'; // 100 mUSDC, 6 decimals.
export const TESTNET_NETWORK = 'testnet' as const;

export type RunStepStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'RUNNING' | 'SKIPPED' | 'UNKNOWN';
export type RunStatus = RunStepStatus;

export interface TestnetBalance {
  /** mUSDC token balance in integer micro-units (6 decimals). */
  tokenMicro?: string;
  /** NEAR balance in yoctoNEAR (24 decimals), used for gas/storage. */
  nearYocto?: string;
  storageUsedBytes?: number;
  storageLimitBytes?: number;
  storageAvailableBytes?: number;
}

export interface TestnetWalletView {
  accountId: string;
  publicKey?: string;
  /** Only present immediately after creation, and only when explicitly allowed. */
  secretKey?: string;
  network: typeof TESTNET_NETWORK;
  hubAccount: string;
  tokenAccount: string;
  createdAt?: string;
  balance: TestnetBalance;
}

export interface FaucetReceiptView {
  accountId?: string;
  amountMicro: string;
  txHash?: string;
  explorerUrl?: string;
  status: 'SUCCESS' | 'FAILED' | 'UNKNOWN';
  message?: string;
}

export interface ScenarioStepView {
  id: string;
  index: number;
  title: string;
  detail?: string;
  status: RunStepStatus;
  txHashes: string[];
  explorerUrls: string[];
  at?: string;
}

export interface ScenarioRunView {
  scenarioId?: string;
  title?: string;
  summary?: string;
  status: RunStatus;
  steps: ScenarioStepView[];
  transactionCount: number;
  linkableTransactionCount: number;
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function records(...values: unknown[]): UnknownRecord[] {
  return values.map(record).filter((value): value is UnknownRecord => value !== null);
}

function pickString(source: UnknownRecord | null | undefined, keys: string[]): string | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function pickNumber(source: UnknownRecord | null | undefined, keys: string[]): number | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim())) return Number(value);
  }
  return undefined;
}

function pickArray(source: UnknownRecord | null | undefined, keys: string[]): unknown[] | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value;
  }
  return undefined;
}

/** Peel common transport wrappers without losing sibling fields. */
function payloadLayers(payload: unknown): UnknownRecord[] {
  const root = record(payload);
  if (!root) return [];
  const layers: UnknownRecord[] = [root];
  for (const key of ['data', 'result', 'wallet', 'account']) {
    const nested = record(root[key]);
    if (nested) layers.push(nested);
  }
  return layers;
}

function firstFromLayers(layers: UnknownRecord[], keys: string[]): string | undefined {
  for (const layer of layers) {
    const value = pickString(layer, keys);
    if (value) return value;
  }
  return undefined;
}

function firstNumberFromLayers(layers: UnknownRecord[], keys: string[]): number | undefined {
  for (const layer of layers) {
    const value = pickNumber(layer, keys);
    if (value !== undefined) return value;
  }
  return undefined;
}

/** Normalise an integer micro amount or a decimal token amount to micro units. */
export function toMicro(value: string | number | undefined): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim().replace(/,/g, '').replace(/\s*(mUSDC|USDC|musdc)$/i, '');
  if (!text) return undefined;
  if (/^\d+$/.test(text)) return text.replace(/^0+(?=\d)/, '');
  if (/^\d+\.\d+$/.test(text)) {
    const [whole = '0', frac = ''] = text.split('.');
    const micro = `${whole}${frac.padEnd(6, '0').slice(0, 6)}`.replace(/^0+(?=\d)/, '');
    return micro || '0';
  }
  return undefined;
}

export function microAmountLabel(micro: string | undefined, symbol = 'mUSDC', decimals = 2): string {
  if (!micro) return `Not reported`;
  try {
    const value = BigInt(micro);
    const whole = value / 1_000_000n;
    const frac = (value % 1_000_000n).toString().padStart(6, '0').slice(0, decimals).padEnd(decimals, '0');
    return decimals > 0 ? `${whole}.${frac} ${symbol}` : `${whole} ${symbol}`;
  } catch {
    return `Not reported`;
  }
}

export function nearAmountLabel(yocto: string | undefined): string {
  if (!yocto) return 'Not reported';
  try {
    const value = BigInt(yocto);
    const whole = value / 1_000_000_000_000_000_000_000_000n;
    const frac = (value % 1_000_000_000_000_000_000_000_000n)
      .toString()
      .padStart(24, '0')
      .slice(0, 4)
      .replace(/0+$/, '');
    return frac ? `${whole}.${frac} NEAR` : `${whole} NEAR`;
  } catch {
    return 'Not reported';
  }
}

export function storagePercent(used?: number, limit?: number): number | null {
  if (used === undefined || limit === undefined || limit <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
}

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return 'Not reported';
  if (bytes < 1_024) return `${Math.round(bytes)} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/** Common response keys for the transport fields. */
const ACCOUNT_KEYS = ['accountId', 'account_id', 'account', 'walletAccountId', 'wallet_account_id'];
const PUBLIC_KEY_KEYS = ['publicKey', 'public_key', 'public_key_str', 'publicKeyStr'];
const SECRET_KEY_KEYS = [
  'secretKey',
  'secret_key',
  'privateKey',
  'private_key',
  'secretKeyStr',
  'privateKeyStr',
];
const TOKEN_MICRO_KEYS = [
  'tokenBalanceMicro',
  'token_balance_micro',
  'tokenMicro',
  'token_micro',
  'musdcBalanceMicro',
  'musdc_balance_micro',
  'musdcMicro',
  'musdc_micro',
  'mUsdcBalanceMicro',
  'balanceMicro',
  'balance_micro',
  'tokenBalance',
  'token_balance',
  'musdcBalance',
  'musdc_balance',
  'mUsdcBalance',
];
const NEAR_YOCTO_KEYS = [
  'nearBalanceYocto',
  'near_balance_yocto',
  'nearBalance',
  'near_balance',
  'nearYocto',
  'near_yocto',
];

function nestedBalanceLayers(layers: UnknownRecord[]): UnknownRecord[] {
  const nested = layers.flatMap((layer) =>
    records(layer.balance, layer.balances, layer.token, layer.musdc, layer.storage),
  );
  return [...layers, ...nested];
}

function readStorage(layers: UnknownRecord[]): Pick<
  TestnetBalance,
  'storageUsedBytes' | 'storageLimitBytes' | 'storageAvailableBytes'
> {
  const source = nestedBalanceLayers(layers);
  let used = firstNumberFromLayers(source, [
    'storageUsedBytes',
    'storage_used_bytes',
    'storageUsed',
    'storage_used',
    'storageUsage',
    'storage_usage',
    'usedBytes',
    'used_bytes',
    'used',
  ]);
  let limit = firstNumberFromLayers(source, [
    'storageLimitBytes',
    'storage_limit_bytes',
    'storageLimit',
    'storage_limit',
    'storageAmt',
    'storage_amt',
    'limitBytes',
    'limit_bytes',
    'limit',
  ]);
  const available = firstNumberFromLayers(source, [
    'storageAvailableBytes',
    'storage_available_bytes',
    'storageAvailable',
    'storage_available',
    'availableBytes',
    'available_bytes',
    'available',
  ]);

  if (limit === undefined && used !== undefined && available !== undefined) limit = used + available;
  if (used === undefined && limit !== undefined && available !== undefined) used = Math.max(0, limit - available);

  return {
    storageUsedBytes: used,
    storageLimitBytes: limit,
    storageAvailableBytes: available,
  };
}

function readBalance(layers: UnknownRecord[]): TestnetBalance {
  const source = nestedBalanceLayers(layers);
  let tokenMicro = firstFromLayers(source, TOKEN_MICRO_KEYS);
  // Some backends call the token amount just `balance`. Only use it when it is
  // clearly not a yoctoNEAR integer (which is normally 19+ digits).
  if (!tokenMicro) {
    const generic = firstFromLayers(layers, ['balance']);
    if (generic) {
      const trimmed = generic.trim().replace(/\s*(mUSDC|USDC)$/i, '');
      const looksNearYocto = /^\d{19,}$/.test(trimmed);
      if (!looksNearYocto && /^(\d+|\d+\.\d+)$/.test(trimmed)) tokenMicro = trimmed;
    }
  }

  const nearYocto = firstFromLayers(source, NEAR_YOCTO_KEYS) ?? (() => {
    const generic = firstFromLayers(layers, ['balance']);
    return generic && /^\d{19,}$/.test(generic.trim()) ? generic.trim() : undefined;
  })();

  return {
    tokenMicro: toMicro(tokenMicro),
    nearYocto,
    ...readStorage(layers),
  };
}

/** Normalise a wallet payload. Pass `allowSecret: false` for every GET. */
export function normalizeWallet(
  payload: unknown,
  { allowSecret = false }: { allowSecret?: boolean } = {},
): TestnetWalletView | null {
  const layers = payloadLayers(payload);
  if (layers.length === 0) return null;

  const accountId = firstFromLayers(layers, ACCOUNT_KEYS);
  if (!accountId) return null;

  return {
    accountId,
    publicKey: firstFromLayers(layers, PUBLIC_KEY_KEYS),
    secretKey: allowSecret ? firstFromLayers(layers, SECRET_KEY_KEYS) : undefined,
    network: TESTNET_NETWORK,
    hubAccount: firstFromLayers(layers, ['hubAccount', 'hub_account']) ?? TESTNET_HUB_ACCOUNT,
    tokenAccount: firstFromLayers(layers, ['tokenAccount', 'token_account']) ?? TESTNET_TOKEN_ACCOUNT,
    createdAt: firstFromLayers(layers, ['createdAt', 'created_at', 'created']),
    balance: readBalance(layers),
  };
}

const TX_HASH_KEYS = [
  'txHash',
  'tx_hash',
  'transactionHash',
  'transaction_hash',
  'hash',
  'txId',
  'tx_id',
];

function hashFrom(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  const nested = record(value);
  return pickString(nested, TX_HASH_KEYS);
}

function collectHashes(...values: unknown[]): string[] {
  const hashes: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        const hash = hashFrom(item);
        if (hash) hashes.push(hash);
      }
      continue;
    }
    const hash = hashFrom(value);
    if (hash) hashes.push(hash);
  }
  return [...new Set(hashes)];
}

/**
 * NEAR transaction hashes are base58. Rejecting anything else keeps a replay
 * fixture, a placeholder or an API mistake from becoming a live explorer link.
 */
export function isPlausibleNearTxHash(value: string | undefined): boolean {
  if (!value) return false;
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,88}$/.test(value)) return false;
  return !/replay|fixture|simulat|example|placeholder/i.test(value);
}

export function explorerTxUrl(txHash: string | undefined): string | undefined {
  return isPlausibleNearTxHash(txHash) ? `${TESTNET_EXPLORER}/transactions/${encodeURIComponent(txHash!)}` : undefined;
}

export function explorerAccountUrl(accountId: string): string {
  return `${TESTNET_EXPLORER}/accounts/${encodeURIComponent(accountId)}`;
}

export function normalizeFaucet(payload: unknown, fallbackAccountId?: string): FaucetReceiptView {
  const root = record(payload);
  const layers = payloadLayers(payload);
  const txLayers = root
    ? [root, ...records(root.transaction, root.tx, root.receipt, root.receipts)].filter(
        (value): value is UnknownRecord => value !== null,
      )
    : [];

  const txHash =
    firstFromLayers(layers, TX_HASH_KEYS) ??
    layers.map((layer) => collectHashes(layer.txHash, layer.tx_hash, layer.txHashes, layer.tx_hashes)).flat()[0] ??
    txLayers.map((layer) => pickString(layer, TX_HASH_KEYS)).find(Boolean);

  const statusText = firstFromLayers(layers, ['status', 'state'])?.toUpperCase();
  const failed = statusText ? /FAIL|ERROR|REJECT|DECLIN/.test(statusText) : false;
  const status: FaucetReceiptView['status'] = failed ? 'FAILED' : txHash ? 'SUCCESS' : 'UNKNOWN';

  const amountMicro =
    toMicro(
      firstFromLayers(layers, [
        'amountMicro',
        'amount_micro',
        'amount',
        'tokenAmount',
        'token_amount',
        'musdcAmount',
        'musdc_amount',
      ]),
    ) ?? TESTNET_FAUCET_MICRO;

  return {
    accountId: firstFromLayers(layers, ACCOUNT_KEYS) ?? fallbackAccountId,
    amountMicro,
    txHash,
    explorerUrl: explorerTxUrl(txHash),
    status,
    message: firstFromLayers(layers, ['message', 'detail', 'description', 'note']),
  };
}

export function normalizeRunStatus(value: string | undefined): RunStepStatus {
  const status = (value ?? '').toUpperCase().replace(/[\s-]+/g, '_');
  if (/^(SUCCESS|SUCCEEDED|COMPLETE|COMPLETED|CONFIRMED|FINALIZED|OK|PASS|PASSED|DONE)$/.test(status)) {
    return 'SUCCESS';
  }
  if (/^(FAIL|FAILED|ERROR|REVERTED|REJECTED|DECLINED|CANCELLED)$/.test(status)) return 'FAILED';
  if (/^(RUNNING|IN_PROGRESS|EXECUTING|STARTED)$/.test(status)) return 'RUNNING';
  if (/^(PENDING|QUEUED|AWAITING|NOT_STARTED)$/.test(status)) return 'PENDING';
  if (/^(SKIPPED|NOT_RUN|OMITTED)$/.test(status)) return 'SKIPPED';
  return 'UNKNOWN';
}

function stepTitle(step: UnknownRecord): string {
  return (
    pickString(step, ['title', 'label', 'name', 'step', 'action', 'method', 'kind']) ??
    'Testnet step'
  );
}

function stepDetail(step: UnknownRecord): string | undefined {
  return pickString(step, [
    'detail',
    'description',
    'message',
    'summary',
    'note',
    'result',
    'outcome',
  ]);
}

function stepStatus(step: UnknownRecord): RunStepStatus {
  const explicit = pickString(step, ['status', 'state', 'result']);
  if (explicit) {
    const normalized = normalizeRunStatus(explicit);
    if (normalized !== 'UNKNOWN') return normalized;
  }
  if (step.ok === true || step.success === true) return 'SUCCESS';
  if (step.ok === false || step.success === false) return 'FAILED';
  return 'UNKNOWN';
}

function stepTimestamp(step: UnknownRecord): string | undefined {
  return pickString(step, ['at', 'timestamp', 'createdAt', 'created_at', 'finishedAt', 'finished_at']);
}

function normaliseStep(step: UnknownRecord, index: number): ScenarioStepView {
  const txHashes = collectHashes(
    step.txHash,
    step.tx_hash,
    step.transactionHash,
    step.transaction_hash,
    step.txId,
    step.tx_id,
    step.txHashes,
    step.tx_hashes,
    step.transactions,
    step.transaction,
    step.tx,
    step.receipts,
  );
  return {
    id: pickString(step, ['id', 'stepId', 'step_id']) ?? `step-${index + 1}`,
    index: index + 1,
    title: stepTitle(step),
    detail: stepDetail(step),
    status: stepStatus(step),
    txHashes,
    explorerUrls: txHashes.map(explorerTxUrl).filter((url): url is string => Boolean(url)),
    at: stepTimestamp(step),
  };
}

/** Normalise `POST /v1/live/run-scenario` into an ordered, honest timeline. */
export function normalizeScenarioRun(payload: unknown): ScenarioRunView | null {
  const rootRecord = record(payload);
  const layers = payloadLayers(payload);
  if (layers.length === 0 && !Array.isArray(payload)) return null;

  const arrays = layers
    .map((layer) => pickArray(layer, ['steps', 'timeline', 'events', 'phases', 'actions']))
    .find((value): value is unknown[] => Boolean(value));
  const rawSteps = arrays ?? (Array.isArray(payload) ? payload : []);

  let steps = rawSteps
    .map(record)
    .filter((step): step is UnknownRecord => step !== null)
    .map(normaliseStep);

  // Some responses return only a flat transaction list. Those are still useful,
  // but they are presented as transaction rows rather than invented step names.
  if (steps.length === 0) {
    const txHashes = collectHashes(
      ...layers.flatMap((layer) => [
        layer.transactions,
        layer.txs,
        layer.txHashes,
        layer.tx_hashes,
        layer.receipts,
        layer.txHash,
        layer.tx_hash,
      ]),
    );
    steps = txHashes.map((txHash, index) => ({
      id: `tx-${index + 1}`,
      index: index + 1,
      title: 'Testnet transaction',
      detail: 'The API returned a transaction hash without a named step.',
      status: 'SUCCESS' as const,
      txHashes: [txHash],
      explorerUrls: [explorerTxUrl(txHash)].filter((url): url is string => Boolean(url)),
      at: undefined,
    }));
  }

  if (steps.length === 0) return null;

  const transactionCount = steps.reduce((count, step) => count + step.txHashes.length, 0);
  const linkableTransactionCount = steps.reduce((count, step) => count + step.explorerUrls.length, 0);
  const explicitStatus = layers
    .map((layer) => pickString(layer, ['status', 'state', 'outcome']))
    .find(Boolean);

  return {
    scenarioId: firstFromLayers(layers, ['scenarioId', 'scenario_id', 'scenario', 'code', 'runId', 'run_id']),
    title:
      firstFromLayers(layers, ['title', 'scenarioTitle', 'scenario_title', 'name']) ??
      'Live testnet scenario',
    summary: firstFromLayers(layers, ['summary', 'message', 'description', 'result']),
    status: explicitStatus ? normalizeRunStatus(explicitStatus) : transactionCount > 0 ? 'SUCCESS' : 'UNKNOWN',
    steps,
    transactionCount,
    linkableTransactionCount,
  };
}

/** Stable JSON payload for the one-time secret-key download. */
export function buildWalletKeyFile(wallet: TestnetWalletView): UnknownRecord {
  return {
    network: TESTNET_NETWORK,
    accountId: wallet.accountId,
    publicKey: wallet.publicKey ?? null,
    secretKey: wallet.secretKey ?? null,
    hubAccount: wallet.hubAccount,
    tokenAccount: wallet.tokenAccount,
    createdAt: wallet.createdAt ?? new Date().toISOString(),
    explorer: `${TESTNET_EXPLORER}/accounts/${encodeURIComponent(wallet.accountId)}`,
    warning:
      'TESTNET ONLY — test value only. This secret key can control this testnet account. Never use it on mainnet. Store it outside the browser.',
  };
}

export function walletKeyFilename(accountId: string): string {
  const safe = accountId.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
  return `mend-testnet-${safe || 'wallet'}.json`;
}
