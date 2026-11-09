import { z } from 'zod';
import { NearRecipientCheckError } from './errors.js';

/**
 * Read-only NEAR mainnet readiness check for an Intents destination.
 *
 * Quote success does NOT prove that a named NEAR recipient exists or that its
 * NEP-141 storage is registered. Check both before enabling live sponsorship.
 * This module never signs or sends anything.
 */

export const NEAR_MAINNET_RPC_URL = 'https://rpc.mainnet.near.org';

const RpcErrorSchema = z.object({
  code: z.number().optional(),
  message: z.string().optional(),
  data: z.unknown().optional(),
  cause: z
    .object({
      name: z.string(),
      info: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

const RpcResponseSchema = z.object({
  jsonrpc: z.string().optional(),
  id: z.unknown().optional(),
  result: z.unknown().optional(),
  error: RpcErrorSchema.optional(),
});

const StorageBalanceSchema = z.object({
  total: z.string(),
  available: z.string(),
});
export type StorageBalance = z.infer<typeof StorageBalanceSchema>;

export interface NearRecipientReadiness {
  accountId: string;
  tokenAccount: string;
  rpcUrl: string;
  exists: boolean;
  storageRegistered: boolean;
  storageBalance: StorageBalance | null;
  accountAmountYocto: string | null;
  checkedAt: string;
  error: string | null;
}

/**
 * Enforce live-sponsorship readiness. Quote success alone does not prove the
 * named account exists or that NEP-141 storage is registered.
 */
export function assertNearRecipientReady(readiness: NearRecipientReadiness): void {
  if (!readiness.exists) {
    throw new NearRecipientCheckError(`NEAR recipient ${readiness.accountId} does not exist`);
  }
  if (!readiness.storageRegistered) {
    throw new NearRecipientCheckError(`NEAR recipient ${readiness.accountId} has no registered storage for ${readiness.tokenAccount}`);
  }
}

export interface NearRecipientCheckOptions {
  accountId: string;
  /** NEP-141 token contract account, e.g. NEAR USDC. */
  tokenAccount: string;
  rpcUrl?: string;
  fetchImpl?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  timeoutMs?: number;
  now?: () => Date;
}

type RpcResult = { result?: unknown; error?: z.infer<typeof RpcErrorSchema> };

async function rpcCall(
  rpcUrl: string,
  body: Record<string, unknown>,
  fetchImpl: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
  timeoutMs: number,
): Promise<RpcResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'mend-intents-client/0.1' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new NearRecipientCheckError('NEAR RPC returned non-JSON response');
    }
    const parsed = RpcResponseSchema.safeParse(raw);
    if (!parsed.success) throw new NearRecipientCheckError('NEAR RPC response failed schema validation');
    return { ...(parsed.data.result !== undefined ? { result: parsed.data.result } : {}), ...(parsed.data.error ? { error: parsed.data.error } : {}) };
  } catch (error) {
    if (error instanceof NearRecipientCheckError) throw error;
    if (controller.signal.aborted) throw new NearRecipientCheckError('NEAR RPC request timed out');
    throw new NearRecipientCheckError('NEAR RPC request failed', { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

function decodeStorageResult(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    const bytes = value.filter((item): item is number => typeof item === 'number');
    return JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return JSON.parse(Buffer.from(value, 'base64').toString('utf8')) as unknown;
    }
  }
  return value;
}

/**
 * Check account existence and NEP-141 storage registration. Returns a result
 * object for missing accounts/storage; throws only for transport/schema errors.
 */
export async function checkNearRecipientReadiness(options: NearRecipientCheckOptions): Promise<NearRecipientReadiness> {
  const rpcUrl = options.rpcUrl ?? NEAR_MAINNET_RPC_URL;
  const fetchImpl = options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  const timeoutMs = options.timeoutMs ?? 15_000;
  const now = options.now ?? (() => new Date());
  const checkedAt = now().toISOString();

  const view = await rpcCall(
    rpcUrl,
    {
      jsonrpc: '2.0',
      id: 'mend-view-account',
      method: 'query',
      params: { request_type: 'view_account', finality: 'final', account_id: options.accountId },
    },
    fetchImpl,
    timeoutMs,
  );

  if (view.error) {
    const name = view.error.cause?.name ?? view.error.data;
    const errorText = typeof name === 'string' ? name : (view.error.message ?? 'RPC_ERROR');
    return {
      accountId: options.accountId,
      tokenAccount: options.tokenAccount,
      rpcUrl,
      exists: false,
      storageRegistered: false,
      storageBalance: null,
      accountAmountYocto: null,
      checkedAt,
      error: errorText,
    };
  }

  const account = z.object({ amount: z.string().optional() }).safeParse(view.result);
  if (!account.success) {
    return {
      accountId: options.accountId,
      tokenAccount: options.tokenAccount,
      rpcUrl,
      exists: false,
      storageRegistered: false,
      storageBalance: null,
      accountAmountYocto: null,
      checkedAt,
      error: 'INVALID_ACCOUNT_RESPONSE',
    };
  }
  const accountAmountYocto = account.data.amount ?? null;

  const argsBase64 = Buffer.from(JSON.stringify({ account_id: options.accountId })).toString('base64');
  const storage = await rpcCall(
    rpcUrl,
    {
      jsonrpc: '2.0',
      id: 'mend-storage-balance',
      method: 'query',
      params: {
        request_type: 'call_function',
        finality: 'final',
        account_id: options.tokenAccount,
        method_name: 'storage_balance_of',
        args_base64: argsBase64,
      },
    },
    fetchImpl,
    timeoutMs,
  );

  if (storage.error) {
    return {
      accountId: options.accountId,
      tokenAccount: options.tokenAccount,
      rpcUrl,
      exists: true,
      storageRegistered: false,
      storageBalance: null,
      accountAmountYocto,
      checkedAt,
      error: storage.error.cause?.name ?? storage.error.message ?? 'STORAGE_CHECK_FAILED',
    };
  }

  const decoded = decodeStorageResult((storage.result as { result?: unknown } | null)?.result);
  const balance = StorageBalanceSchema.safeParse(decoded);
  return {
    accountId: options.accountId,
    tokenAccount: options.tokenAccount,
    rpcUrl,
    exists: true,
    storageRegistered: balance.success,
    storageBalance: balance.success ? balance.data : null,
    accountAmountYocto,
    checkedAt,
    error: balance.success ? null : 'STORAGE_NOT_REGISTERED',
  };
}
