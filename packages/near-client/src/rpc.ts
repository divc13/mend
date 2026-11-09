import { NearClientError } from './errors.js';
import type { NearClientConfig } from './config.js';
import { assertLiveCallsAllowed } from './config.js';

export interface RpcTransport {
  request(method: string, params: unknown): Promise<unknown>;
}

export interface FetchTransportOptions {
  url: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

export class FetchRpcTransport implements RpcTransport {
  private readonly url: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: FetchTransportOptions) {
    this.url = options.url;
    this.timeoutMs = options.timeoutMs;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async request(method: string, params: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'mend-near-client', method, params }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new NearClientError('RPC_ERROR', `HTTP ${response.status} from ${this.url}`);
      }
      return (await response.json()) as unknown;
    } finally {
      clearTimeout(timer);
    }
  }
}

export interface AccessKeyPermissionView {
  FunctionCall?: {
    allowance: string | null;
    receiver_id: string;
    method_names: string[];
  };
}

export interface AccessKeyView {
  public_key: string;
  access_key: {
    nonce: number;
    permission: 'FullAccess' | AccessKeyPermissionView;
  };
}

export interface AccessKeyList {
  keys: AccessKeyView[];
  block_height: number;
}

export interface AccountView {
  amount: string;
  code_hash: string;
  storage_usage: number;
}

export interface ViewCallResult<T> {
  value: T;
  logs: string[];
  blockHeight: number;
  blockHash: string;
}

export interface FunctionCallAction {
  methodName: string;
  args: Record<string, unknown>;
  gas: string;
  deposit: string;
}

export interface SignedTransactionRequest {
  signerId: string;
  receiverId: string;
  actions: FunctionCallAction[];
}

export interface TransactionResult {
  transactionHash: string;
  success: boolean;
  logs: string[];
}

/**
 * The live signer lives outside this package. The client never stores or logs a
 * private key; a caller must provide a signer deliberately for a labelled run.
 */
export interface TransactionSigner {
  readonly accountId: string;
  signAndSend(request: SignedTransactionRequest): Promise<TransactionResult>;
}

interface JsonRpcEnvelope {
  jsonrpc?: string;
  id?: string | number;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
}

function asEnvelope(raw: unknown): JsonRpcEnvelope {
  if (!raw || typeof raw !== 'object') {
    throw new NearClientError('UNEXPECTED_RESPONSE', 'JSON-RPC response was not an object');
  }
  return raw as JsonRpcEnvelope;
}

function decodeQueryResult(raw: unknown): unknown {
  const envelope = asEnvelope(raw);
  if (envelope.error) {
    throw new NearClientError('RPC_ERROR', envelope.error.message ?? 'RPC error', {
      code: envelope.error.code,
      data: envelope.error.data,
    });
  }
  const result = envelope.result as Record<string, unknown> | undefined;
  if (!result) {
    throw new NearClientError('UNEXPECTED_RESPONSE', 'JSON-RPC response had no result');
  }
  if (result.error) {
    const error = result.error as { message?: string; name?: string };
    throw new NearClientError('RPC_ERROR', error.message ?? error.name ?? 'query error', { error: result.error });
  }
  return result;
}

function decodeBytes(value: unknown): string {
  if (Array.isArray(value)) {
    return Buffer.from(value as number[]).toString('utf8');
  }
  if (typeof value === 'string') {
    return Buffer.from(value, 'base64').toString('utf8');
  }
  throw new NearClientError('UNEXPECTED_RESPONSE', 'call_function result was not byte data');
}

export class NearRpcClient {
  readonly config: NearClientConfig;
  private readonly transport: RpcTransport;
  private readonly transportInjected: boolean;

  constructor(config: NearClientConfig, transport?: RpcTransport) {
    this.config = config;
    this.transportInjected = Boolean(transport);
    this.transport = transport ?? new FetchRpcTransport({ url: config.rpcUrl, timeoutMs: config.timeoutMs });
  }

  /** Read-only contract view. A real RPC call requires the explicit live flag. */
  async view<T = unknown>(accountId: string, methodName: string, args: Record<string, unknown> = {}): Promise<ViewCallResult<T>> {
    if (!this.transportInjected) assertLiveCallsAllowed(this.config);
    const result = decodeQueryResult(
      await this.transport.request('query', {
        request_type: 'call_function',
        finality: 'final',
        account_id: accountId,
        method_name: methodName,
        args_base64: Buffer.from(JSON.stringify(args), 'utf8').toString('base64'),
      }),
    ) as Record<string, unknown>;

    const bytes = result.result;
    const text = decodeBytes(bytes);
    let value: T;
    try {
      value = (text.length === 0 ? null : JSON.parse(text)) as T;
    } catch {
      throw new NearClientError('VIEW_FAILED', `view ${accountId}.${methodName} returned non-JSON`);
    }
    return {
      value,
      logs: Array.isArray(result.logs) ? (result.logs as string[]) : [],
      blockHeight: Number(result.block_height ?? 0),
      blockHash: String(result.block_hash ?? ''),
    };
  }

  async viewAccount(accountId: string): Promise<AccountView> {
    const result = decodeQueryResult(
      await this.transport.request('query', {
        request_type: 'view_account',
        finality: 'final',
        account_id: accountId,
      }),
    ) as AccountView;
    return result;
  }

  async viewAccessKey(accountId: string, publicKey: string): Promise<AccessKeyView> {
    const result = decodeQueryResult(
      await this.transport.request('query', {
        request_type: 'view_access_key',
        finality: 'final',
        account_id: accountId,
        public_key: publicKey,
      }),
    ) as AccessKeyView;
    return result;
  }

  async viewAccessKeys(accountId: string): Promise<AccessKeyList> {
    const result = decodeQueryResult(
      await this.transport.request('query', {
        request_type: 'view_access_key_list',
        finality: 'final',
        account_id: accountId,
      }),
    ) as AccessKeyList;
    return result;
  }

  async blockHeight(): Promise<number> {
    const envelope = asEnvelope(await this.transport.request('block', { finality: 'final' }));
    if (envelope.error) {
      throw new NearClientError('RPC_ERROR', envelope.error.message ?? 'block query failed');
    }
    const result = envelope.result as { header?: { height?: number } } | undefined;
    const height = result?.header?.height;
    if (typeof height !== 'number') {
      throw new NearClientError('UNEXPECTED_RESPONSE', 'block result had no header.height');
    }
    return height;
  }

  /**
   * State-changing calls are impossible without an explicit live flag and a
   * caller-supplied signer. This package never contains key material.
   */
  async call(request: SignedTransactionRequest, signer: TransactionSigner): Promise<TransactionResult> {
    assertLiveCallsAllowed(this.config);
    if (!signer || typeof signer.signAndSend !== 'function') {
      throw new NearClientError('SIGNER_REQUIRED', 'a deliberate external signer is required');
    }
    if (signer.accountId !== request.signerId) {
      throw new NearClientError('SIGNER_REQUIRED', 'signer account does not match request signerId');
    }
    if (request.actions.length !== 1) {
      throw new NearClientError('KEY_NOT_ALLOWED', 'function-call keys permit exactly one action per transaction');
    }
    for (const action of request.actions) {
      if (action.deposit !== '0') {
        throw new NearClientError(
          'KEY_NOT_ALLOWED',
          'this client only supports zero-deposit function-call keys; deposit-bearing calls are not gasless',
        );
      }
    }
    return signer.signAndSend(request);
  }
}
