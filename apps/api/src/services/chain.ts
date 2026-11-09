import {
  HUB_METHODS,
  REPLAY_LABEL,
  sha256Hex,
  stableStringify,
  type WorkOrderMode,
} from '@mend/protocol';
import type { ChainCommandRecord, ChainCommandState, Repository } from '@mend/db';
import type { AppConfig } from '../config.js';

export interface ChainIntentInput {
  id: string;
  workOrderId?: string;
  action: string;
  method: string;
  args: Record<string, unknown>;
  mode: WorkOrderMode;
}

export interface ChainAdapterResult {
  state: ChainCommandState;
  txHash?: string;
  errorCode?: string;
  errorMessage?: string;
  realTransaction: boolean;
  label?: string;
}

export interface ChainAdapter {
  readonly kind: string;
  readonly available: boolean;
  readonly unavailableReason?: string;
  submit(intent: ChainIntentInput): Promise<ChainAdapterResult>;
}

/**
 * Labelled replay adapter. It returns a deterministic `replay:` hash and never
 * claims a real transaction. The API response and stored command carry
 * `realTransaction: false` and the REPLAY label.
 */
export class ReplayChainAdapter implements ChainAdapter {
  readonly kind = 'replay' as const;
  readonly available = true;

  async submit(intent: ChainIntentInput): Promise<ChainAdapterResult> {
    const digest = sha256Hex(stableStringify({
      id: intent.id,
      workOrderId: intent.workOrderId ?? null,
      action: intent.action,
      method: intent.method,
      args: intent.args,
    }));
    return {
      state: 'SUCCESS',
      txHash: `replay:${digest}`,
      realTransaction: false,
      label: REPLAY_LABEL,
    };
  }
}

/** No signer/credentials: actions stay INTENT and are never reported executed. */
export class UnavailableChainAdapter implements ChainAdapter {
  readonly kind = 'unavailable' as const;
  readonly available = false;
  readonly unavailableReason: string;

  constructor(reason: string) {
    this.unavailableReason = reason;
  }

  async submit(): Promise<ChainAdapterResult> {
    return {
      state: 'INTENT',
      errorCode: 'UPSTREAM_UNAVAILABLE',
      errorMessage: this.unavailableReason,
      realTransaction: false,
    };
  }
}

/** For tests/recovery: broadcast status unknown, so the command stays PENDING. */
export class PendingChainAdapter implements ChainAdapter {
  readonly kind = 'pending' as const;
  readonly available = true;

  async submit(): Promise<ChainAdapterResult> {
    return {
      state: 'PENDING',
      errorMessage: 'RPC response indeterminate; command is not confirmed and must be reconciled.',
      realTransaction: false,
    };
  }
}

/** For tests: explicit failure remains FAILED and never applies the transition. */
export class FailingChainAdapter implements ChainAdapter {
  readonly kind = 'failing' as const;
  readonly available = true;

  async submit(): Promise<ChainAdapterResult> {
    return {
      state: 'FAILED',
      errorCode: 'UPSTREAM_UNAVAILABLE',
      errorMessage: 'Simulated RPC failure',
      realTransaction: false,
    };
  }
}

/**
 * A live adapter must sign and broadcast a real NEAR transaction. No signer
 * implementation ships in this wave, so it refuses to act rather than pretend.
 */
export class LiveRpcChainAdapter implements ChainAdapter {
  readonly kind = 'live' as const;
  readonly available = false;
  readonly unavailableReason: string;

  constructor(config: AppConfig['chain']) {
    this.unavailableReason = config.signerConfigured
      ? 'Live signer helper is not implemented in this wave; refusing to broadcast an unsigned or partially signed action.'
      : (config.unavailableReason ?? 'No NEAR signer configured; action stays INTENT.');
  }

  async submit(): Promise<ChainAdapterResult> {
    return {
      state: 'INTENT',
      errorCode: 'UPSTREAM_UNAVAILABLE',
      errorMessage: this.unavailableReason,
      realTransaction: false,
    };
  }
}

export function createChainAdapter(config: AppConfig): ChainAdapter {
  if (config.mode !== 'REPLAY' && config.chain.adapter === 'replay') {
    return new UnavailableChainAdapter(
      `Replay adapter refuses to run in ${config.mode} mode. Switch MEND_MODE to REPLAY or configure a verified signer.`,
    );
  }
  switch (config.chain.adapter) {
    case 'replay':
      return new ReplayChainAdapter();
    case 'pending':
      return new PendingChainAdapter();
    case 'failing':
      return new FailingChainAdapter();
    case 'live':
      return new LiveRpcChainAdapter(config.chain);
    default:
      return new UnavailableChainAdapter(config.chain.unavailableReason ?? 'No chain adapter is available.');
  }
}

export interface SubmitCommandInput {
  workOrderId?: string;
  action: string;
  method: string;
  args?: Record<string, unknown>;
  isDemo?: boolean;
}

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/**
 * Chain command service. Every action is first stored as an INTENT. Only an
 * adapter result with state SUCCESS and a transaction hash can move it to
 * SUCCESS. RPC failures remain FAILED; indeterminate broadcasts remain PENDING.
 */
export class ChainCommandService {
  constructor(
    private readonly adapter: ChainAdapter,
    private readonly config: AppConfig,
    private readonly clock: Clock = systemClock,
  ) {}

  get adapterInfo(): { kind: string; available: boolean; reason?: string } {
    return {
      kind: this.adapter.kind,
      available: this.adapter.available,
      ...(this.adapter.unavailableReason ? { reason: this.adapter.unavailableReason } : {}),
    };
  }

  async submit(repo: Repository, input: SubmitCommandInput): Promise<ChainCommandRecord> {
    const now = this.clock.now().toISOString();
    const seq = await repo.nextSequence('chain-command');
    const id = `CMD-${String(seq).padStart(4, '0')}`;
    const mode = this.config.mode;
    let command = await repo.createChainCommand({
      id,
      workOrderId: input.workOrderId,
      action: input.action,
      method: input.method,
      args: input.args ?? {},
      state: 'INTENT',
      mode,
      adapter: this.adapter.kind,
      realTransaction: false,
      createdAt: now,
      updatedAt: now,
      isDemo: input.isDemo ?? false,
    });

    const result = await this.adapter.submit({
      id,
      workOrderId: input.workOrderId,
      action: input.action,
      method: input.method,
      args: input.args ?? {},
      mode,
    });

    const patch: Parameters<Repository['updateChainCommand']>[1] = {
      state: result.state,
      updatedAt: this.clock.now().toISOString(),
      realTransaction: result.realTransaction,
    };
    if (result.txHash) patch.txHash = result.txHash;
    if (result.errorCode) patch.errorCode = result.errorCode;
    if (result.errorMessage) patch.errorMessage = result.errorMessage;
    // A command can never be SUCCESS without a transaction hash.
    if (result.state === 'SUCCESS' && !result.txHash) {
      patch.state = 'FAILED';
      patch.errorCode = 'UPSTREAM_UNAVAILABLE';
      patch.errorMessage = 'Adapter reported success without a transaction hash; refusing to mark it executed.';
    }
    command = (await repo.updateChainCommand(id, patch)) ?? command;

    await repo.appendAudit({
      id: `A-${String(await repo.nextSequence('audit')).padStart(5, '0')}`,
      name: `chain_command_${command.state.toLowerCase()}`,
      actor: 'chain-command-service',
      workOrderId: input.workOrderId,
      at: this.clock.now().toISOString(),
      data: {
        commandId: command.id,
        action: command.action,
        method: command.method,
        state: command.state,
        realTransaction: command.realTransaction,
        adapter: command.adapter,
        ...(command.txHash ? { txHash: command.txHash } : {}),
      },
    });
    return command;
  }
}

export const HUB_METHOD_BY_ACTION: Record<string, string> = {
  dao_authorize: 'dao_authorize',
  fund: 'fund_work_order',
  open_bidding: HUB_METHODS.openBidding,
  close_bidding: HUB_METHODS.closeBidding,
  record_score: HUB_METHODS.recordScore,
  award: HUB_METHODS.award,
  start_work: 'start_work',
  submit_completion: HUB_METHODS.submitCompletion,
  accept_completion: HUB_METHODS.acceptCompletion,
  inspect_durability: HUB_METHODS.inspectDurability,
  open_dispute: HUB_METHODS.openDispute,
  resolve_dispute: HUB_METHODS.resolveDispute,
  cancel_work_order: 'cancel_work_order',
  refund: HUB_METHODS.refund,
  pause: HUB_METHODS.pause,
  unpause: HUB_METHODS.unpause,
  mint_passport: HUB_METHODS.mintPassport,
  commit_bid: HUB_METHODS.commitBid,
  reveal_bid: HUB_METHODS.revealBid,
};
