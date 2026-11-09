import { isKnownExecutionStatus, type ExecutionStatusResponse, type MendIntentState } from './schemas.js';
import type { StatusResult } from './results.js';

/**
 * MEND sponsorship flow states. A detected deposit is never a completed
 * sponsorship; SUCCESS only becomes FUNDED after reconciliation proves the
 * destination transaction, amount, recipient and escrow funding.
 */
export const SPONSORSHIP_FLOW_STATES = [
  'CREATED',
  'AWAITING_SPONSOR_FUNDS',
  'DEPOSIT_DETECTED',
  'SETTLING',
  'FUNDED',
  'UNDERFUNDED',
  'REFUNDED',
  'FAILED',
  'EXPIRED',
] as const;
export type SponsorshipFlowState = (typeof SPONSORSHIP_FLOW_STATES)[number];

export type StatusLike = Pick<StatusResult, 'response' | 'verified'> & { raw?: unknown };

export interface TrackStatusOptions {
  /** Injectable clock for deterministic tests. */
  now?: Date;
  /** Override the quote deadline (ISO string or Date). */
  deadline?: string | Date | null;
}

export interface TrackedStatus {
  /** MEND's six client-facing states. */
  state: MendIntentState;
  /** Operational flow state used by the UI/backend. */
  flowState: SponsorshipFlowState;
  /** Exact raw status string, even when unknown. */
  rawStatus: string;
  /** False when the API returned an undocumented value (fail closed). */
  known: boolean;
  failClosed: boolean;
  terminal: boolean;
  expired: boolean;
  /** Client-only expiry because 1Click has no EXPIRED status. */
  clientExpired: boolean;
  quoteDeadline: string | null;
  verified: boolean;
  /** Free-form detail such as refundReason; no separate sub-status enum exists. */
  substatus: string | null;
  refundReason: string | null;
  refundedAmount: string | null;
  depositedAmount: string | null;
  amountOut: string | null;
  destinationTxHashes: string[];
  reason: string | null;
  /** Raw status response preserved verbatim for diagnostics. */
  raw: unknown;
}

function toIso(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

export function extractQuoteDeadline(response: ExecutionStatusResponse): string | null {
  const quote = response.quoteResponse?.quote;
  const request = response.quoteResponse?.quoteRequest;
  return toIso(quote?.deadline) ?? toIso(quote?.timeWhenInactive) ?? toIso(request?.deadline);
}

function nonEmpty(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Map every documented 1Click status to MEND's six states.
 *
 * PENDING_DEPOSIT, KNOWN_DEPOSIT_TX, PROCESSING -> PENDING
 * SUCCESS -> SUCCESS
 * INCOMPLETE_DEPOSIT -> INCOMPLETE (underfunded; never credited)
 * REFUNDED -> REFUNDED
 * FAILED -> FAILED
 * PENDING_DEPOSIT past the client deadline -> EXPIRED (client-only)
 * anything else -> INCOMPLETE with failClosed=true and raw preserved
 */
export function trackStatus(status: StatusLike, options: TrackStatusOptions = {}): TrackedStatus {
  const { response } = status;
  const rawStatus = response.status;
  const known = isKnownExecutionStatus(rawStatus);
  const now = options.now ?? new Date();
  const quoteDeadline = toIso(options.deadline) ?? extractQuoteDeadline(response);
  const deadlineMs = quoteDeadline === null ? null : Date.parse(quoteDeadline);
  const clientExpired = rawStatus === 'PENDING_DEPOSIT' && deadlineMs !== null && now.getTime() >= deadlineMs;

  const swap = response.swapDetails;
  const refundReason = nonEmpty(swap.refundReason);
  const refundedAmount = nonEmpty(swap.refundedAmount);
  const depositedAmount = nonEmpty(swap.depositedAmount) ?? nonEmpty(swap.amountIn);
  const amountOut = nonEmpty(swap.amountOut);
  const destinationTxHashes = swap.destinationChainTxHashes.map((tx) => tx.hash).filter((hash) => hash.length > 0);

  let state: MendIntentState;
  let flowState: SponsorshipFlowState;
  let terminal = false;
  let reason: string | null = null;

  switch (rawStatus) {
    case 'PENDING_DEPOSIT':
      if (clientExpired) {
        state = 'EXPIRED';
        flowState = 'EXPIRED';
        terminal = true;
        reason = 'QUOTE_DEADLINE_PASSED';
      } else {
        state = 'PENDING';
        flowState = 'AWAITING_SPONSOR_FUNDS';
        reason = 'AWAITING_DEPOSIT';
      }
      break;
    case 'KNOWN_DEPOSIT_TX':
      state = 'PENDING';
      flowState = 'DEPOSIT_DETECTED';
      reason = 'DEPOSIT_DETECTED';
      break;
    case 'PROCESSING':
      state = 'PENDING';
      flowState = 'SETTLING';
      reason = 'SETTLING';
      break;
    case 'SUCCESS':
      state = 'SUCCESS';
      // Deliberately not FUNDED: reconciliation must prove destination tx,
      // amount, recipient and escrow funding first.
      flowState = 'SETTLING';
      terminal = true;
      reason = 'AWAITING_RECONCILIATION';
      break;
    case 'INCOMPLETE_DEPOSIT':
      state = 'INCOMPLETE';
      flowState = 'UNDERFUNDED';
      // Documented as non-terminal/undocumented; never credit.
      terminal = false;
      reason = refundReason ?? 'INCOMPLETE_DEPOSIT';
      break;
    case 'REFUNDED':
      state = 'REFUNDED';
      flowState = 'REFUNDED';
      terminal = true;
      reason = refundReason ?? 'REFUNDED';
      break;
    case 'FAILED':
      state = 'FAILED';
      flowState = 'FAILED';
      terminal = true;
      reason = refundReason ?? 'FAILED';
      break;
    default:
      state = 'INCOMPLETE';
      flowState = 'UNDERFUNDED';
      terminal = false;
      reason = `UNKNOWN_STATUS:${rawStatus}`;
      break;
  }

  return {
    state,
    flowState,
    rawStatus,
    known,
    failClosed: !known,
    terminal,
    expired: state === 'EXPIRED',
    clientExpired,
    quoteDeadline,
    verified: status.verified,
    substatus: refundReason,
    refundReason,
    refundedAmount,
    depositedAmount,
    amountOut,
    destinationTxHashes,
    reason,
    raw: status.raw ?? response,
  };
}
