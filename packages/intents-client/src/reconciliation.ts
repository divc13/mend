import { buildChainTxLink } from './explorer.js';
import type { StatusLike, SponsorshipFlowState, TrackedStatus } from './status.js';
import { trackStatus } from './status.js';

export type ReconciliationOutcome =
  | 'FUNDED'
  | 'UNDERFUNDED'
  | 'REFUNDED'
  | 'FAILED'
  | 'EXPIRED'
  | 'INCOMPLETE'
  | 'PENDING'
  | 'DUPLICATE';

export interface SponsorshipBinding {
  /** Off-chain work-order binding. The API does not return a work-order id. */
  workOrderId: string;
  /** Reconciliation key. sessionId is not preserved by /v0/status. */
  depositAddress: string;
  originAsset: string;
  destinationAsset: string;
  recipient: string;
  /** Exact requested input in base units (integer string). */
  amountIn: string;
  /** Minimum acceptable output; falls back to the signed quote's minAmountOut. */
  minAmountOut?: string;
  /** Destination chain code for explorer links; defaults to near. */
  destinationChain?: string;
  /** NEAR token account/contract expected to hold escrow, when known. */
  escrowToken?: string;
}

export interface EscrowFunding {
  workOrderId: string;
  token: string;
  fundedMicro: string;
}

export interface ReconcileOptions {
  binding: SponsorshipBinding;
  escrow?: EscrowFunding;
  now?: Date;
  deadline?: string | Date | null;
  /** Destination tx hashes already credited for this work order. */
  seenDestinationTxHashes?: readonly string[];
  /** True when the work order was already credited from this deposit. */
  alreadyCredited?: boolean;
  /** Defaults to true. Set false only for diagnostic views, never for crediting. */
  requireDestinationTx?: boolean;
}

export interface ReconciliationCheck {
  id: string;
  ok: boolean;
  detail: string;
}

export interface ReconciliationResult {
  outcome: ReconciliationOutcome;
  /** True only for the first fully proven FUNDED settlement. */
  credited: boolean;
  creditedAmount: string | null;
  workOrderId: string;
  state: TrackedStatus['state'];
  flowState: SponsorshipFlowState;
  rawStatus: string;
  verified: boolean;
  destinationTxHash: string | null;
  destinationTxHashes: string[];
  explorerUrl: string | null;
  amountInExpected: string | null;
  amountInActual: string | null;
  amountOut: string | null;
  minAmountOut: string | null;
  shortfall: string | null;
  excess: string | null;
  overpaid: boolean;
  duplicate: boolean;
  proofPending: boolean;
  refundedAmount: string | null;
  refundReason: string | null;
  reason: string | null;
  checks: ReconciliationCheck[];
}

function bigintOrNull(value: string | null | undefined): bigint | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  return BigInt(value);
}

function nonEmpty(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Reconcile a status response against the intended work order.
 *
 * Crediting requires ALL of:
 *  - verified signed quote
 *  - matching depositAddress (the only reliable reconciliation key)
 *  - matching recipient, destination asset, origin asset and requested amount
 *  - deposited amount not below the requested amount
 *  - output at least minAmountOut
 *  - a destination-chain transaction hash
 *  - no duplicate callback / prior credit
 *  - escrow funded for the same work order with at least the output amount
 *
 * Underpayment, overpayment, duplicate callbacks, delayed settlement, refunds,
 * failures and missing proofs all fail closed without crediting.
 */
export function reconcileStatus(status: StatusLike, options: ReconcileOptions): ReconciliationResult {
  const { binding } = options;
  const tracked = trackStatus(status, { now: options.now, deadline: options.deadline });
  const { response } = status;
  const swap = response.swapDetails;
  const quoteResponse = response.quoteResponse;
  const quote = quoteResponse?.quote;
  const request = quoteResponse?.quoteRequest;
  const destinationTxs = swap.destinationChainTxHashes.filter((tx) => tx.hash.length > 0);
  const destinationTx = destinationTxs[0];
  const destinationTxHash = destinationTx?.hash ?? null;
  const destinationChain = binding.destinationChain ?? 'near';
  const explorerUrl = destinationTx
    ? (buildChainTxLink(destinationChain, destinationTx.hash, destinationTx.explorerUrl)?.url ?? null)
    : null;

  const checks: ReconciliationCheck[] = [];
  const add = (id: string, ok: boolean, detail: string): void => {
    checks.push({ id, ok, detail });
  };

  const expectedIn = bigintOrNull(binding.amountIn);
  const actualIn = bigintOrNull(swap.depositedAmount) ?? bigintOrNull(swap.amountIn);
  const amountOut = bigintOrNull(swap.amountOut) ?? bigintOrNull(quote?.amountOut);
  const minAmountOut = bigintOrNull(binding.minAmountOut) ?? bigintOrNull(quote?.minAmountOut);

  const base = {
    workOrderId: binding.workOrderId,
    state: tracked.state,
    flowState: tracked.flowState,
    rawStatus: tracked.rawStatus,
    verified: status.verified,
    destinationTxHash,
    destinationTxHashes: destinationTxs.map((tx) => tx.hash),
    explorerUrl,
    amountInExpected: expectedIn?.toString() ?? null,
    amountInActual: actualIn?.toString() ?? null,
    amountOut: amountOut?.toString() ?? null,
    minAmountOut: minAmountOut?.toString() ?? null,
    shortfall: null as string | null,
    excess: null as string | null,
    overpaid: false,
    duplicate: false,
    proofPending: false,
    refundedAmount: tracked.refundedAmount,
    refundReason: tracked.refundReason,
    checks,
  };

  add('workOrderId', binding.workOrderId.trim().length > 0, binding.workOrderId.trim().length > 0 ? binding.workOrderId : 'work-order id is empty');

  if (tracked.state === 'REFUNDED') {
    add('status', true, 'REFUNDED');
    return { ...base, outcome: 'REFUNDED', credited: false, creditedAmount: null, reason: tracked.refundReason ?? 'REFUNDED' };
  }

  if (tracked.state === 'FAILED') {
    add('status', true, 'FAILED');
    return { ...base, outcome: 'FAILED', credited: false, creditedAmount: null, reason: tracked.refundReason ?? 'FAILED' };
  }

  if (tracked.state === 'EXPIRED') {
    add('status', true, 'client-only expiry: PENDING_DEPOSIT past quote deadline');
    return { ...base, outcome: 'EXPIRED', credited: false, creditedAmount: null, reason: 'QUOTE_DEADLINE_PASSED' };
  }

  if (tracked.state === 'INCOMPLETE') {
    add('status', false, tracked.failClosed ? `unknown status ${tracked.rawStatus}` : 'INCOMPLETE_DEPOSIT');
    const shortfall =
      expectedIn !== null && actualIn !== null && expectedIn > actualIn ? (expectedIn - actualIn).toString() : null;
    return {
      ...base,
      shortfall,
      outcome: 'UNDERFUNDED',
      credited: false,
      creditedAmount: null,
      reason: tracked.failClosed ? `UNKNOWN_STATUS:${tracked.rawStatus}` : (tracked.refundReason ?? 'INCOMPLETE_DEPOSIT'),
    };
  }

  if (tracked.state === 'PENDING') {
    add('status', true, `pending: ${tracked.rawStatus}`);
    return { ...base, outcome: 'PENDING', credited: false, creditedAmount: null, reason: tracked.reason };
  }

  // tracked.state === 'SUCCESS'
  add('signature', status.verified, status.verified ? 'signed quote verified' : 'quote signature missing or invalid');

  if (!quoteResponse || !quote || !request) {
    add('signedQuote', false, 'status has no complete quoteResponse');
    return { ...base, outcome: 'INCOMPLETE', credited: false, creditedAmount: null, reason: 'MISSING_SIGNED_QUOTE' };
  }

  add(
    'depositAddress',
    quote.depositAddress === binding.depositAddress,
    quote.depositAddress === binding.depositAddress ? 'depositAddress matches binding' : `expected ${binding.depositAddress}, quote has ${quote.depositAddress ?? 'none'}`,
  );
  add(
    'recipient',
    request.recipient === binding.recipient,
    request.recipient === binding.recipient ? 'recipient matches binding' : `expected ${binding.recipient}, quote has ${request.recipient}`,
  );
  add(
    'destinationAsset',
    request.destinationAsset === binding.destinationAsset,
    request.destinationAsset === binding.destinationAsset ? 'destination asset matches binding' : `expected ${binding.destinationAsset}, quote has ${request.destinationAsset}`,
  );
  add(
    'originAsset',
    request.originAsset === binding.originAsset,
    request.originAsset === binding.originAsset ? 'origin asset matches binding' : `expected ${binding.originAsset}, quote has ${request.originAsset}`,
  );
  add(
    'requestedAmount',
    request.amount === binding.amountIn,
    request.amount === binding.amountIn ? 'requested amount matches binding' : `expected ${binding.amountIn}, quote has ${request.amount}`,
  );

  if (expectedIn === null || actualIn === null) {
    add('depositedAmount', false, 'deposited amount or expected amount is missing/not an integer');
    return { ...base, outcome: 'INCOMPLETE', credited: false, creditedAmount: null, reason: 'MISSING_DEPOSITED_AMOUNT' };
  }

  if (actualIn < expectedIn) {
    const shortfall = (expectedIn - actualIn).toString();
    add('depositedAmount', false, `underpaid by ${shortfall} base units`);
    return { ...base, shortfall, outcome: 'UNDERFUNDED', credited: false, creditedAmount: null, reason: 'UNDERPAYMENT' };
  }

  const overpaid = actualIn > expectedIn;
  const excess = overpaid ? (actualIn - expectedIn).toString() : null;
  add('depositedAmount', true, overpaid ? `overpaid by ${excess} base units; credit only the intended output` : 'deposit matches requested amount');

  if (amountOut === null || minAmountOut === null) {
    add('amountOut', false, 'settled output or minimum output is missing/not an integer');
    return { ...base, excess, overpaid, outcome: 'INCOMPLETE', credited: false, creditedAmount: null, reason: 'MISSING_OUTPUT_AMOUNT' };
  }

  if (amountOut < minAmountOut) {
    add('amountOut', false, `output ${amountOut} is below minAmountOut ${minAmountOut}`);
    return { ...base, excess, overpaid, outcome: 'INCOMPLETE', credited: false, creditedAmount: null, reason: 'OUTPUT_BELOW_MINIMUM' };
  }
  add('amountOut', true, `output ${amountOut} >= minAmountOut ${minAmountOut}`);

  if (destinationTxHash === null) {
    add('destinationTx', false, 'SUCCESS has no destination-chain transaction hash');
    if (options.requireDestinationTx === false) {
      // Diagnostic mode only. Never use this to credit.
    } else {
      return {
        ...base,
        excess,
        overpaid,
        proofPending: true,
        outcome: 'PENDING',
        credited: false,
        creditedAmount: null,
        reason: 'AWAITING_DESTINATION_TX',
      };
    }
  } else {
    add('destinationTx', true, `destination tx ${destinationTxHash}`);
  }

  if (options.alreadyCredited === true) {
    add('duplicate', false, 'work order already credited');
    return { ...base, excess, overpaid, duplicate: true, outcome: 'DUPLICATE', credited: false, creditedAmount: null, reason: 'ALREADY_CREDITED' };
  }

  if (destinationTxHash !== null && options.seenDestinationTxHashes?.includes(destinationTxHash) === true) {
    add('duplicate', false, `destination tx ${destinationTxHash} already processed`);
    return { ...base, excess, overpaid, duplicate: true, outcome: 'DUPLICATE', credited: false, creditedAmount: null, reason: 'DUPLICATE_DESTINATION_TX' };
  }
  add('duplicate', true, 'destination tx not previously processed');

  if (!options.escrow) {
    add('escrow', false, 'escrow funding not supplied');
    return { ...base, excess, overpaid, outcome: 'INCOMPLETE', credited: false, creditedAmount: null, reason: 'MISSING_ESCROW_FUNDING' };
  }

  const { escrow } = options;
  add('escrowWorkOrder', escrow.workOrderId === binding.workOrderId, escrow.workOrderId === binding.workOrderId ? 'escrow work order matches' : `expected ${binding.workOrderId}, escrow has ${escrow.workOrderId}`);
  if (binding.escrowToken !== undefined) {
    add('escrowToken', escrow.token === binding.escrowToken, escrow.token === binding.escrowToken ? 'escrow token matches' : `expected ${binding.escrowToken}, escrow has ${escrow.token}`);
  }

  const funded = bigintOrNull(escrow.fundedMicro);
  if (funded === null) {
    add('escrowAmount', false, 'escrow funded amount is not an integer');
  } else if (funded < amountOut) {
    add('escrowAmount', false, `escrow funded ${funded} is below output ${amountOut}`);
  } else {
    add('escrowAmount', true, `escrow funded ${funded} >= output ${amountOut}`);
  }

  const failedCheck = checks.find((check) => !check.ok);
  if (failedCheck) {
    return { ...base, excess, overpaid, outcome: 'INCOMPLETE', credited: false, creditedAmount: null, reason: `CHECK_FAILED:${failedCheck.id}` };
  }

  return {
    ...base,
    excess,
    overpaid,
    outcome: 'FUNDED',
    credited: true,
    creditedAmount: amountOut.toString(),
    reason: null,
  };
}
