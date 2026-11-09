import {
  MendError,
  WORK_ORDER_ID_PATTERN,
  isNearAccount,
  makeEvent,
  sha256Hex,
  stableStringify,
} from '@mend/protocol';
import type { ErrorCode, MendEvent } from '@mend/protocol';
import type { AccessKeyView } from '@mend/near-client';
import type { RelayerPolicy } from './policy.js';
import type {
  DelegateAction,
  DelegateFunctionCall,
  DelegateSignatureVerifier,
  SignedDelegateAction,
} from './types.js';

export interface RelayEvaluationContext {
  currentBlockHeight: number;
  /** Milliseconds since epoch, used for rate windows and audit timestamps. */
  now: number;
  accessKey?: AccessKeyView;
  signatureVerifier?: DelegateSignatureVerifier;
}

export interface RelayDecision {
  ok: true;
  delegateHash: string;
  senderId: string;
  receiverId: string;
  method: string;
  workOrderId: string;
  budgetMicro?: string;
  signatureVerified: boolean;
  keyScoped: boolean;
}

export interface RelayTransaction {
  signerId: string;
  receiverId: string;
  actions: Array<{ delegate: SignedDelegateAction }>;
}

interface DailyUsage {
  day: string;
  calls: number;
  budgetMicro: bigint;
}

interface WorkOrderUsage {
  calls: number;
  budgetMicro: bigint;
}

const REQUIRED_FIELDS: Readonly<Record<string, readonly string[]>> = {
  create_work_order: ['work_order_id', 'budget'],
  commit_bid: ['work_order_id', 'bid_id', 'commitment_hash'],
  reveal_bid: ['work_order_id', 'bid_id'],
  submit_completion: ['work_order_id', 'evidence_id', 'evidence_hash'],
};

function reject(code: ErrorCode, message: string, details?: Record<string, unknown>): never {
  throw new MendError(code, message, details);
}

function decodeArgs(call: DelegateFunctionCall): Record<string, unknown> {
  let text: string;
  try {
    text = Buffer.from(call.args, 'base64').toString('utf8');
  } catch {
    reject('VALIDATION_ERROR', 'delegate args are not valid base64');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    reject('VALIDATION_ERROR', 'delegate args are not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    reject('VALIDATION_ERROR', 'delegate args must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

function dayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/**
 * NEP-366 delegate gate. Validates the protocol shape, sender/contract/method
 * allowlists, key scope, gas, TTL, nonce, replay, rate limits, daily budget
 * and per-work-order caps. It never holds a user key and never signs anything.
 */
export class RelayGate {
  readonly policy: RelayerPolicy;
  private readonly replayCache = new Set<string>();
  private readonly senderCalls = new Map<string, number[]>();
  private readonly lastNonce = new Map<string, bigint>();
  private readonly perWorkOrder = new Map<string, WorkOrderUsage>();
  private daily: DailyUsage = { day: '', calls: 0, budgetMicro: 0n };
  private readonly audit: MendEvent[] = [];

  constructor(policy: RelayerPolicy) {
    this.policy = policy;
  }

  get events(): readonly MendEvent[] {
    return [...this.audit];
  }

  setKillSwitch(enabled: boolean): void {
    this.policy.killSwitch = enabled;
  }

  evaluate(signed: SignedDelegateAction, context: RelayEvaluationContext): RelayDecision {
    try {
      return this.check(signed, context);
    } catch (error) {
      const mendError = error instanceof MendError ? error : new MendError('VALIDATION_ERROR', String(error));
      this.audit.push(
        makeEvent(
          'relayer_rejected',
          {
            reason: mendError.code,
            message: mendError.message,
            details: mendError.details ?? {},
            senderId: signed?.delegateAction?.senderId ?? 'unknown',
            method: signed?.delegateAction?.actions?.[0]?.functionCall?.methodName ?? 'unknown',
          },
          {
            actor: signed?.delegateAction?.senderId ?? 'unknown',
            timestamp: new Date(context.now).toISOString(),
          },
        ),
      );
      throw error;
    }
  }

  private check(signed: SignedDelegateAction, context: RelayEvaluationContext): RelayDecision {
    if (this.policy.killSwitch) {
      reject('FORBIDDEN_ROLE', 'relayer kill switch is active');
    }
    const delegate = signed?.delegateAction;
    if (!delegate || typeof delegate !== 'object') reject('VALIDATION_ERROR', 'missing delegate action');
    if (typeof signed.signature !== 'string' || signed.signature.length < 8) {
      reject('UNAUTHORIZED', 'delegate signature is missing');
    }
    if (!isNearAccount(delegate.senderId)) reject('UNAUTHORIZED', 'invalid delegate sender');
    if (!this.policy.allowedSenders.includes(delegate.senderId)) {
      reject('UNAUTHORIZED', 'sender is not on the relayer allowlist', { senderId: delegate.senderId });
    }

    if (this.policy.requireSignature) {
      if (!context.signatureVerifier) {
        reject('UNAUTHORIZED', 'no signature verifier configured; refusing to sponsor an unverified delegate');
      }
      if (!context.signatureVerifier.verify(signed)) {
        reject('UNAUTHORIZED', 'delegate signature verification failed');
      }
    }

    if (delegate.receiverId !== this.policy.hubAccount) {
      reject('RELAYER_TARGET_NOT_ALLOWED', 'delegate receiver is not the MEND hub', {
        receiverId: delegate.receiverId,
      });
    }
    if (!Array.isArray(delegate.actions) || delegate.actions.length !== 1) {
      reject('VALIDATION_ERROR', 'delegate must contain exactly one non-delegate action');
    }
    const item = delegate.actions[0];
    if (!item || typeof item !== 'object' || !item.functionCall) {
      reject('VALIDATION_ERROR', 'delegate action must be a FunctionCall');
    }
    const call = item.functionCall;
    if (typeof call.methodName !== 'string' || !this.policy.allowedMethods.includes(call.methodName)) {
      reject('RELAYER_METHOD_NOT_ALLOWED', `method ${String(call.methodName)} is not relayable`, {
        method: call.methodName,
      });
    }
    if (call.deposit !== '0') {
      reject('VALIDATION_ERROR', 'delegate FunctionCall must have zero deposit; function-call keys cannot attach funds');
    }
    if (!/^\d+$/.test(call.gas) || BigInt(call.gas) <= 0n) {
      reject('VALIDATION_ERROR', 'delegate gas must be a positive decimal integer');
    }
    if (BigInt(call.gas) > BigInt(this.policy.maxGas)) {
      reject('VALIDATION_ERROR', 'delegate gas exceeds the relayer maximum');
    }

    if (!Number.isInteger(delegate.maxBlockHeight)) reject('VALIDATION_ERROR', 'invalid maxBlockHeight');
    if (delegate.maxBlockHeight <= context.currentBlockHeight) {
      reject('VALIDATION_ERROR', 'delegate has expired');
    }
    if (delegate.maxBlockHeight > context.currentBlockHeight + this.policy.maxBlockTtl) {
      reject('VALIDATION_ERROR', 'delegate TTL is longer than the relayer maximum');
    }

    if (!/^\d+$/.test(delegate.nonce)) reject('VALIDATION_ERROR', 'delegate nonce must be a decimal integer');
    const nonce = BigInt(delegate.nonce);
    const keyNonce = this.checkScopedKey(delegate, call, context);
    const nonceKey = `${delegate.senderId}|${delegate.publicKey}`;
    const baseline = this.lastNonce.get(nonceKey) ?? keyNonce;
    if (nonce <= baseline) {
      reject('RELAYER_REPLAY', 'delegate nonce is not greater than the last seen nonce');
    }
    if (nonce > baseline + BigInt(this.policy.maxNonceAhead)) {
      reject('VALIDATION_ERROR', 'delegate nonce is implausibly far ahead');
    }

    const delegateHash = sha256Hex(stableStringify(signed));
    if (this.replayCache.has(delegateHash)) {
      reject('RELAYER_REPLAY', 'delegate was already relayed');
    }

    const args = decodeArgs(call);
    const required = REQUIRED_FIELDS[call.methodName] ?? [];
    for (const field of required) {
      if (typeof args[field] !== 'string' || String(args[field]).length === 0) {
        reject('VALIDATION_ERROR', `delegate args missing required field ${field}`);
      }
    }
    const workOrderId = String(args.work_order_id ?? '');
    if (!WORK_ORDER_ID_PATTERN.test(workOrderId)) {
      reject('VALIDATION_ERROR', 'delegate args have an invalid work_order_id');
    }

    let budgetMicro: bigint | undefined;
    if (call.methodName === 'create_work_order') {
      const budget = String(args.budget ?? '');
      if (!/^\d+$/.test(budget) || BigInt(budget) <= 0n) {
        reject('VALIDATION_ERROR', 'create_work_order budget must be a positive integer micro amount');
      }
      budgetMicro = BigInt(budget);
      if (budgetMicro > BigInt(this.policy.perWorkOrderCapMicro)) {
        reject('VALIDATION_ERROR', 'work-order budget exceeds the per-work-order cap');
      }
    }

    const rateKey = delegate.senderId;
    const windowStart = context.now - this.policy.rateWindowMs;
    const recent = (this.senderCalls.get(rateKey) ?? []).filter((stamp) => stamp > windowStart);
    if (recent.length >= this.policy.maxCallsPerSenderPerWindow) {
      reject('RELAYER_RATE_LIMITED', 'sender exceeded the relayer rate limit');
    }

    const day = dayKey(context.now);
    if (this.daily.day !== day) this.daily = { day, calls: 0, budgetMicro: 0n };
    if (this.daily.calls >= this.policy.maxCallsPerDay) {
      reject('RELAYER_RATE_LIMITED', 'daily call cap reached');
    }
    if (budgetMicro !== undefined && this.daily.budgetMicro + budgetMicro > BigInt(this.policy.dailyCapMicro)) {
      reject('RELAYER_RATE_LIMITED', 'daily sponsored budget cap reached');
    }

    const uso = this.perWorkOrder.get(workOrderId) ?? { calls: 0, budgetMicro: 0n };
    if (uso.calls >= this.policy.maxCallsPerWorkOrder) {
      reject('RELAYER_RATE_LIMITED', 'per-work-order call cap reached');
    }
    if (call.methodName === 'create_work_order' && uso.calls > 0) {
      reject('RELAYER_RATE_LIMITED', 'create_work_order was already relayed for this work order');
    }
    if (budgetMicro !== undefined && uso.budgetMicro + budgetMicro > BigInt(this.policy.perWorkOrderCapMicro)) {
      reject('RELAYER_RATE_LIMITED', 'per-work-order budget cap reached');
    }

    // All checks passed: commit state only now.
    this.replayCache.add(delegateHash);
    this.lastNonce.set(nonceKey, nonce);
    this.senderCalls.set(rateKey, [...recent, context.now]);
    this.daily.calls += 1;
    if (budgetMicro !== undefined) this.daily.budgetMicro += budgetMicro;
    this.perWorkOrder.set(workOrderId, {
      calls: uso.calls + 1,
      budgetMicro: uso.budgetMicro + (budgetMicro ?? 0n),
    });

    return {
      ok: true,
      delegateHash,
      senderId: delegate.senderId,
      receiverId: delegate.receiverId,
      method: call.methodName,
      workOrderId,
      ...(budgetMicro !== undefined ? { budgetMicro: budgetMicro.toString() } : {}),
      signatureVerified: this.policy.requireSignature,
      keyScoped: this.policy.requireScopedKey,
    };
  }

  private checkScopedKey(
    delegate: DelegateAction,
    call: DelegateFunctionCall,
    context: RelayEvaluationContext,
  ): bigint {
    const key = context.accessKey;
    if (!key) {
      if (this.policy.requireScopedKey) {
        reject('UNAUTHORIZED', 'scoped access key was not supplied for verification');
      }
      return 0n;
    }
    if (key.public_key !== delegate.publicKey) {
      reject('UNAUTHORIZED', 'delegate public key does not match the fetched access key');
    }
    if (key.access_key.permission === 'FullAccess') {
      reject('UNAUTHORIZED', 'delegates must be signed by a function-call key, not a full-access key');
    }
    const fc = key.access_key.permission.FunctionCall;
    if (!fc) reject('UNAUTHORIZED', 'delegate key is not a function-call key');
    if (!Array.isArray(fc.method_names) || fc.method_names.length === 0) {
      reject('UNAUTHORIZED', 'delegate key has an empty method list');
    }
    if (fc.receiver_id !== this.policy.hubAccount) {
      reject('UNAUTHORIZED', 'delegate key is not scoped to the MEND hub');
    }
    if (!fc.method_names.includes(call.methodName)) {
      reject('UNAUTHORIZED', 'delegate key does not permit this method');
    }
    if (fc.allowance === null) {
      reject('UNAUTHORIZED', 'delegate key has an unlimited allowance');
    }
    const nonce = key.access_key.nonce;
    if (!Number.isInteger(nonce) || nonce < 0) reject('UNAUTHORIZED', 'access key nonce is invalid');
    return BigInt(nonce);
  }
}

/** Builds the outer transaction shape. The relayer signs it externally with its own hot key. */
export function buildRelayTransaction(signed: SignedDelegateAction, relayerAccountId: string): RelayTransaction {
  if (!isNearAccount(relayerAccountId)) {
    throw new MendError('VALIDATION_ERROR', 'invalid relayer account');
  }
  return {
    signerId: relayerAccountId,
    receiverId: signed.delegateAction.senderId,
    actions: [{ delegate: signed }],
  };
}
