import {
  IntentsApiError,
  IntentsNetworkError,
  IntentsSchemaError,
  IntentsTimeoutError,
  InvalidQuoteRequestError,
  NearRecipientCheckError,
  QuoteSignatureError,
} from './errors.js';
import { assertMainnetExecutionAllowed, type GuardEnv } from './mainnet-guard.js';
import { assertNearRecipientReady, type NearRecipientReadiness } from './near-recipient.js';
import type { QuoteResult, StatusResult, TokensResult } from './results.js';
import {
  ExecutionStatusResponseSchema,
  IntentsErrorBodySchema,
  QuoteRequestSchema,
  QuoteResponseSchema,
  TokenResponseSchema,
  type AppFee,
  type QuoteRequest,
  type QuoteResponse,
} from './schemas.js';
import { verifySignedQuote } from './signature.js';
import { trackStatus, type TrackedStatus } from './status.js';

export const ONE_CLICK_BASE_URL = 'https://1click.chaindefuser.com';
export const DEFAULT_USER_AGENT = 'mend-intents-client/0.1';
export const DEFAULT_TIMEOUT_MS = 15_000;

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface OneClickClientOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  /** Partner JWT. Server-side only; never expose to the browser or logs. */
  apiKey?: string;
  userAgent?: string;
  timeoutMs?: number;
  env?: GuardEnv;
  now?: () => Date;
}

export interface QuoteParams {
  originAsset: string;
  destinationAsset: string;
  /** Integer string in the origin asset's smallest unit. */
  amount: string;
  recipient: string;
  refundTo: string;
  recipientType?: QuoteRequest['recipientType'];
  depositType?: QuoteRequest['depositType'];
  refundType?: QuoteRequest['refundType'];
  slippageTolerance?: number;
  deadline?: string | Date;
  referral?: string;
  sessionId?: string;
  appFees?: AppFee[];
  insured?: boolean;
  quoteWaitingTimeMs?: number;
}

export interface GetQuoteOptions {
  /** Explicit per-call human confirmation, required with MEND_ALLOW_MAINNET=true. */
  confirmMainnet?: boolean;
  /** Required readiness proof for a non-dry quote. */
  recipientReadiness?: NearRecipientReadiness;
  /** Diagnostic escape hatch; never use to enable live sponsorship. */
  allowUnverifiedRecipient?: boolean;
}

export interface CreateDepositQuoteOptions extends GetQuoteOptions {
  /** Explicit per-call human confirmation, required with MEND_ALLOW_MAINNET=true. */
  confirmMainnet: boolean;
}

export interface GetStatusOptions {
  depositMemo?: string;
  /**
   * Defaults to true. When false, a status response with no quoteResponse is
   * accepted (for recorded excerpts) but an invalid present signature is still
   * rejected. Reconciliation will never credit an unverified response.
   */
  requireSignature?: boolean;
}

export interface PollStatusOptions extends GetStatusOptions {
  deadline?: string | Date | null;
  timeoutMs?: number;
  intervalsMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  onStatus?: (tracked: TrackedStatus, result: StatusResult) => void;
}

export interface PollStatusResult {
  result: StatusResult;
  tracked: TrackedStatus;
  attempts: number;
  timedOut: boolean;
}

interface RawResponse {
  parsed: unknown;
  raw: unknown;
}

function sleepDefault(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 5 s for the first 2 minutes, then 15 s, then 60 s. */
export function backoffDelayMs(attempt: number): number {
  if (attempt < 24) return 5_000;
  if (attempt < 32) return 15_000;
  return 60_000;
}

function toDeadline(value: string | Date | undefined, now: Date, fallbackMinutes: number): string {
  if (value === undefined) return new Date(now.getTime() + fallbackMinutes * 60_000).toISOString();
  return value instanceof Date ? value.toISOString() : value;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

export class OneClickClient {
  readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly apiKey: string | undefined;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly env: GuardEnv;
  private readonly now: () => Date;

  constructor(options: OneClickClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? ONE_CLICK_BASE_URL).replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
    this.apiKey = options.apiKey;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.env = options.env ?? process.env;
    this.now = options.now ?? (() => new Date());
  }

  /** Supported-asset discovery. Read-only, no auth required. */
  async getTokens(): Promise<TokensResult> {
    const { parsed, raw } = await this.request('/v0/tokens', { method: 'GET' }, [200]);
    const result = TokenResponseSchema.array().safeParse(parsed);
    if (!result.success) throw new IntentsSchemaError('/v0/tokens', result.error.issues);
    return { tokens: result.data, raw };
  }

  /**
   * Send a quote request. Non-dry requests are mainnet execution and are
   * blocked unless MEND_ALLOW_MAINNET=true AND confirmMainnet:true, plus a
   * passing NEAR recipient readiness check. Every response is schema-validated
   * and signature-verified.
   */
  async getQuote(request: QuoteRequest, options: GetQuoteOptions = {}): Promise<QuoteResult> {
    const parsedRequest = QuoteRequestSchema.safeParse(request);
    if (!parsedRequest.success) throw new InvalidQuoteRequestError(parsedRequest.error.issues);

    assertMainnetExecutionAllowed({
      dry: parsedRequest.data.dry,
      confirmMainnet: options.confirmMainnet,
      env: this.env,
    });

    if (!parsedRequest.data.dry && options.allowUnverifiedRecipient !== true) {
      if (!options.recipientReadiness) {
        throw new NearRecipientCheckError('live sponsorship requires a NEAR recipient readiness check (view_account + storage_balance_of)');
      }
      assertNearRecipientReady(options.recipientReadiness);
    }

    const { parsed, raw } = await this.request(
      '/v0/quote',
      { method: 'POST', body: JSON.stringify(parsedRequest.data) },
      [200, 201],
    );
    const result = QuoteResponseSchema.safeParse(parsed);
    if (!result.success) throw new IntentsSchemaError('/v0/quote', result.error.issues);

    if (!verifySignedQuote(raw)) {
      throw new QuoteSignatureError('1Click quote signature verification failed; rejecting quote');
    }

    if (result.data.quoteRequest.dry) {
      const quote = result.data.quote;
      if (
        quote.depositAddress !== undefined ||
        quote.depositMemo !== undefined ||
        quote.deadline !== undefined ||
        quote.timeWhenInactive !== undefined
      ) {
        throw new IntentsSchemaError('/v0/quote', [
          { message: 'dry quote must not contain depositAddress, depositMemo, deadline or timeWhenInactive' },
        ]);
      }
    }

    return { response: result.data, raw, verified: true };
  }

  /** Dry preview. Never allocates a deposit address and never moves funds. */
  async getDryQuote(params: QuoteParams): Promise<QuoteResult> {
    return this.getQuote(this.buildRequest(params, true));
  }

  /**
   * Non-dry quote: allocates a real mainnet deposit address. This does not
   * move funds and never signs anything; the human sponsor sends the transfer.
   */
  async createDepositQuote(params: QuoteParams, options: CreateDepositQuoteOptions): Promise<QuoteResult> {
    const result = await this.getQuote(this.buildRequest(params, false), {
      confirmMainnet: options.confirmMainnet,
      ...(options.recipientReadiness !== undefined ? { recipientReadiness: options.recipientReadiness } : {}),
      ...(options.allowUnverifiedRecipient !== undefined ? { allowUnverifiedRecipient: options.allowUnverifiedRecipient } : {}),
    });
    const depositAddress = result.response.quote.depositAddress?.trim();
    if (!depositAddress) {
      throw new IntentsSchemaError('/v0/quote', [{ message: 'non-dry quote is missing depositAddress' }]);
    }
    return result;
  }

  /** Poll execution status. Read-only; never calls deposit/submit. */
  async getStatus(depositAddress: string, options: GetStatusOptions = {}): Promise<StatusResult> {
    const query = new URLSearchParams({ depositAddress });
    if (options.depositMemo) query.set('depositMemo', options.depositMemo);
    const { parsed, raw } = await this.request(`/v0/status?${query.toString()}`, { method: 'GET' }, [200]);
    const result = ExecutionStatusResponseSchema.safeParse(parsed);
    if (!result.success) throw new IntentsSchemaError('/v0/status', result.error.issues);

    let verified = false;
    if (result.data.quoteResponse) {
      const rawQuote = (raw as { quoteResponse?: unknown } | null)?.quoteResponse;
      if (!verifySignedQuote(rawQuote)) {
        throw new QuoteSignatureError('1Click status quoteResponse signature verification failed');
      }
      verified = true;
    } else if (options.requireSignature !== false) {
      throw new QuoteSignatureError('1Click status response has no signed quoteResponse');
    }

    return { response: result.data, raw, verified };
  }

  /**
   * Poll with backoff until terminal, timeout, or client-side expiry.
   * INCOMPLETE_DEPOSIT is deliberately non-terminal and never credited.
   */
  async pollStatus(depositAddress: string, options: PollStatusOptions = {}): Promise<PollStatusResult> {
    const now = options.now ?? this.now;
    const sleep = options.sleep ?? sleepDefault;
    const timeoutMs = options.timeoutMs ?? 30 * 60_000;
    const intervals = options.intervalsMs;
    const start = now().getTime();
    let attempts = 0;

    for (;;) {
      attempts += 1;
      const result = await this.getStatus(depositAddress, options);
      const tracked = trackStatus(result, { now: now(), deadline: options.deadline });
      options.onStatus?.(tracked, result);

      if (tracked.terminal) {
        return { result, tracked, attempts, timedOut: false };
      }

      const elapsed = now().getTime() - start;
      if (elapsed >= timeoutMs) {
        return { result, tracked, attempts, timedOut: true };
      }

      const delay = intervals?.[attempts - 1] ?? backoffDelayMs(attempts - 1);
      await sleep(Math.max(0, Math.min(delay, timeoutMs - elapsed)));
    }
  }

  private buildRequest(params: QuoteParams, dry: boolean): QuoteRequest {
    const now = this.now();
    return {
      dry,
      swapType: 'EXACT_INPUT',
      slippageTolerance: params.slippageTolerance ?? 50,
      originAsset: params.originAsset,
      depositType: params.depositType ?? 'ORIGIN_CHAIN',
      destinationAsset: params.destinationAsset,
      amount: params.amount,
      refundTo: params.refundTo,
      refundType: params.refundType ?? 'ORIGIN_CHAIN',
      recipient: params.recipient,
      recipientType: params.recipientType ?? 'DESTINATION_CHAIN',
      deadline: toDeadline(params.deadline, now, dry ? 30 : 60),
      referral: params.referral ?? 'mend',
      ...(params.sessionId !== undefined ? { sessionId: params.sessionId } : {}),
      ...(params.appFees !== undefined ? { appFees: params.appFees } : {}),
      ...(params.insured !== undefined ? { insured: params.insured } : {}),
      ...(params.quoteWaitingTimeMs !== undefined ? { quoteWaitingTimeMs: params.quoteWaitingTimeMs } : {}),
    };
  }

  private async request(path: string, init: RequestInit, expectedStatuses: readonly number[]): Promise<RawResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers: Record<string, string> = {
      accept: 'application/json',
      'user-agent': this.userAgent,
    };
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    if (this.apiKey !== undefined && this.apiKey.length > 0) headers['x-api-key'] = this.apiKey;

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        throw new IntentsTimeoutError(`1Click request timed out after ${this.timeoutMs}ms for ${path}`);
      }
      throw new IntentsNetworkError(`1Click network request failed for ${path}`, { cause: error });
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let raw: unknown = null;
    if (text.length > 0) {
      try {
        raw = JSON.parse(text);
      } catch {
        raw = text;
      }
    }

    if (!expectedStatuses.includes(response.status)) {
      const errorBody = IntentsErrorBodySchema.safeParse(raw);
      const message = errorBody.success && errorBody.data.message ? errorBody.data.message : `1Click API returned ${response.status} for ${path}`;
      throw new IntentsApiError(response.status, path, errorBody.success ? errorBody.data : raw, message);
    }

    return { parsed: raw, raw };
  }
}

/** Parse a raw quote response without network access (fixtures/tests). */
export function parseQuoteResponse(raw: unknown): QuoteResponse {
  const parsed = QuoteResponseSchema.safeParse(raw);
  if (!parsed.success) throw new IntentsSchemaError('/v0/quote', parsed.error.issues);
  return parsed.data;
}
