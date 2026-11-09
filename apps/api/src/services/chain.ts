import {
  HUB_METHODS,
  REPLAY_LABEL,
  sha256Hex,
  stableStringify,
  type WorkOrderMode,
} from '@mend/protocol';
import type { ChainCommandRecord, ChainCommandState, Repository } from '@mend/db';
import type { AppConfig } from '../config.js';
import {
  LiveChainTxFailure,
  MissingTestnetSignerError,
  NearLiveChain,
  reasonHash,
  type LiveChainExecutor,
  type TestnetRole,
} from './testnet-chain.js';

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

/** The role that must sign each hub action. Never taken from request input. */
export const LIVE_ROLE_BY_ACTION: Record<string, TestnetRole> = {
  dao_authorize: 'dao',
  fund: 'sponsor',
  open_bidding: 'steward',
  close_bidding: 'steward',
  award: 'steward',
  record_score: 'steward',
  start_work: 'contractor',
  submit_completion: 'contractor',
  commit_bid: 'contractor',
  reveal_bid: 'contractor',
  accept_completion: 'inspector',
  inspect_durability: 'inspector',
  open_dispute: 'steward',
  resolve_dispute: 'dao',
  cancel_work_order: 'steward',
  refund: 'steward',
  pause: 'admin',
  unpause: 'admin',
  mint_passport: 'steward',
};

function deadlineNs(value: unknown, fallbackMs: number): bigint {
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  const ms = Number.isFinite(parsed) ? parsed : fallbackMs;
  return BigInt(Math.floor(ms)) * 1_000_000n;
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * Translate the API's camelCase command args into the contract's exact JSON
 * argument names. Unknown/extra API fields are deliberately not forwarded.
 */
export function liveHubArgs(action: string, args: Record<string, unknown>, commandId: string): Record<string, unknown> {
  const fallbackDeadline = Date.now() + 60_000;
  switch (action) {
    case 'dao_authorize':
      return {
        work_order_id: text(args.workOrderId, ''),
        proposal_id: text(args.daoApprovalId ?? args.proposalId, ''),
        scope_hash: text(args.scopeHash, ''),
        policy_hash: text(args.policyHash, ''),
        budget: text(args.budgetMicro, '0'),
        contractor_roster: stringArray(args.contractorRoster),
        inspector_roster: stringArray(args.inspectorRoster),
        commit_deadline: deadlineNs(args.commitDeadline, fallbackDeadline),
        reveal_deadline: deadlineNs(args.revealDeadline, fallbackDeadline + 60_000),
      };
    case 'open_bidding':
    case 'close_bidding':
    case 'start_work':
    case 'refund':
      return { work_order_id: text(args.workOrderId, '') };
    case 'award':
      return {
        work_order_id: text(args.workOrderId, ''),
        bid_id: text(args.bidId, ''),
      };
    case 'record_score': {
      const ranking = Array.isArray(args.ranking) ? args.ranking : [];
      return {
        work_order_id: text(args.workOrderId, ''),
        execution_id: text(args.executionId, commandId),
        policy_hash: text(args.policyHash, ''),
        wasm_hash: text(args.wasmHash, ''),
        input_hash: text(args.inputHash, ''),
        output_hash: text(args.outputHash, ''),
        ranking: ranking.map((entry) => {
          const row = (entry ?? {}) as Record<string, unknown>;
          // ScoredRank is serialized with rename_all = camelCase by the hub.
          return {
            rank: Number(row.rank ?? 0),
            bidId: text(row.bidId ?? row.bid_id, ''),
            contractorId: text(row.contractorId ?? row.contractor_id, ''),
            scoreBps: Number(row.scoreBps ?? row.score_bps ?? 0),
          };
        }),
      };
    }
    case 'submit_completion':
      return {
        work_order_id: text(args.workOrderId, ''),
        evidence_id: text(args.evidenceId, ''),
        evidence_hash: text(args.evidenceHash, ''),
      };
    case 'accept_completion':
      return {
        work_order_id: text(args.workOrderId, ''),
        inspection_id: text(args.inspectionId, ''),
        notes_hash: reasonHash(args.notesHash, `notes:${text(args.inspectionId, '')}`),
      };
    case 'inspect_durability':
      return {
        work_order_id: text(args.workOrderId, ''),
        passed: args.passed === true,
        inspection_id: text(args.inspectionId, ''),
        notes_hash: reasonHash(args.notesHash, `notes:${text(args.inspectionId, '')}`),
      };
    case 'open_dispute':
      return {
        work_order_id: text(args.workOrderId, ''),
        reason_hash: reasonHash(args.reasonHash, 'dispute'),
      };
    case 'resolve_dispute':
      return {
        work_order_id: text(args.workOrderId, ''),
        target_state: text(args.targetState, ''),
        resolution_hash: reasonHash(args.resolutionHash ?? args.targetState, 'resolved'),
      };
    case 'cancel_work_order':
      return {
        work_order_id: text(args.workOrderId, ''),
        reason_hash: reasonHash(args.reasonHash, 'cancelled'),
      };
    case 'pause':
      return { reason_hash: reasonHash(args.reasonHash ?? args.reason, 'paused') };
    case 'unpause':
      return {};
    case 'commit_bid':
      return {
        work_order_id: text(args.workOrderId, ''),
        bid_id: text(args.bidId, ''),
        commitment_hash: text(args.commitmentHash, ''),
      };
    case 'reveal_bid':
      return {
        work_order_id: text(args.workOrderId, ''),
        bid_id: text(args.bidId, ''),
        price: text(args.priceMicro, '0'),
        duration_days: Number(args.durationDays ?? 0),
        warranty_days: Number(args.warrantyDays ?? 0),
        materials_score: Number(args.materialsScore ?? 0),
        available_in_days: Number(args.availableInDays ?? 0),
        checklist_accepted: args.evidenceChecklistAccepted === true,
        nonce: text(args.nonce, ''),
      };
    default:
      throw new Error(`No live hub argument mapping for action ${action}`);
  }
}

function sanitizeMessage(message: string): string {
  return message
    .replace(/ed25519:[A-Za-z0-9]+/g, 'ed25519:[redacted]')
    .replace(/\s+/g, ' ')
    .slice(0, 500);
}

/**
 * Real testnet chain adapter. It signs with the configured role account and
 * only reports SUCCESS after a real transaction hash is returned. Missing
 * signers, RPC failures and on-chain failures stay FAILED (or PENDING when the
 * broadcast outcome is genuinely indeterminate) and never apply a transition.
 */
export class LiveRpcChainAdapter implements ChainAdapter {
  readonly kind = 'live' as const;
  readonly available: boolean;
  readonly unavailableReason?: string;

  constructor(
    private readonly chain: LiveChainExecutor,
    private readonly config: AppConfig['chain'],
  ) {
    this.available = config.network === 'testnet' && chain.available;
    this.unavailableReason = config.network !== 'testnet'
      ? 'MAINNET is refused. The live adapter signs NEAR testnet transactions only.'
      : chain.unavailableReason;
  }

  private roleAccount(role: TestnetRole): string {
    return this.config.roleAccounts[role];
  }

  async submit(intent: ChainIntentInput): Promise<ChainAdapterResult> {
    if (!this.available) {
      return {
        state: 'INTENT',
        errorCode: 'UPSTREAM_UNAVAILABLE',
        errorMessage: this.unavailableReason ?? 'Live testnet adapter is unavailable; action stays INTENT.',
        realTransaction: false,
      };
    }
    const role = LIVE_ROLE_BY_ACTION[intent.action];
    if (!role) {
      return {
        state: 'FAILED',
        errorCode: 'UNAVAILABLE',
        errorMessage: `No role signer mapping for action ${intent.action}; refusing to sign.`,
        realTransaction: false,
      };
    }
    const signer = this.roleAccount(role);
    try {
      if (!this.chain.keys.has(signer)) {
        throw new MissingTestnetSignerError(signer, role);
      }
      let tx;
      if (intent.action === 'fund') {
        const workOrderId = text(intent.args.workOrderId, '');
        const amount = text(intent.args.amountMicro, '0');
        const requestedSponsor = intent.args.sponsorId;
        if (typeof requestedSponsor === 'string' && requestedSponsor !== signer) {
          return {
            state: 'FAILED',
            errorCode: 'FORBIDDEN_ROLE',
            errorMessage: `Funding signer ${signer} cannot act for sponsor ${requestedSponsor}.`,
            realTransaction: false,
          };
        }
        if (text(intent.args.token, this.config.tokenAccount) !== this.config.tokenAccount) {
          return {
            state: 'FAILED',
            errorCode: 'FUNDING_WRONG_TOKEN',
            errorMessage: 'Funding token is not the configured testnet token.',
            realTransaction: false,
          };
        }
        tx = await this.chain.call(signer, this.config.tokenAccount, 'ft_transfer_call', {
          receiver_id: this.config.hubAccount,
          amount,
          memo: 'MEND testnet funding (test value only)',
          msg: workOrderId,
        }, { deposit: 1n, gas: 100_000_000_000_000n });
      } else {
        const method = intent.method;
        tx = await this.chain.call(
          signer,
          this.config.hubAccount,
          method,
          liveHubArgs(intent.action, intent.args, intent.id),
          { gas: 100_000_000_000_000n },
        );
      }
      return {
        state: 'SUCCESS',
        txHash: tx.txHash,
        realTransaction: true,
      };
    } catch (error) {
      if (error instanceof MissingTestnetSignerError) {
        return {
          state: 'FAILED',
          errorCode: 'UNAUTHORIZED',
          errorMessage: sanitizeMessage(error.message),
          realTransaction: false,
        };
      }
      if (error instanceof LiveChainTxFailure) {
        return {
          state: 'FAILED',
          errorCode: 'UPSTREAM_UNAVAILABLE',
          errorMessage: sanitizeMessage(error.message),
          ...(error.txHash ? { txHash: error.txHash } : {}),
          realTransaction: Boolean(error.txHash),
        };
      }
      const message = sanitizeMessage(error instanceof Error ? error.message : String(error));
      const indeterminate = /timeout|timed out|indeterminate|not confirmed|unknown|ECONNRESET|socket hang up/i.test(message);
      return {
        state: indeterminate ? 'PENDING' : 'FAILED',
        errorCode: 'UPSTREAM_UNAVAILABLE',
        errorMessage: indeterminate
          ? `${message} The broadcast outcome is unknown; the command stays PENDING and is not executed.`
          : message,
        realTransaction: false,
      };
    }
  }
}

export function createChainAdapter(config: AppConfig, chain?: LiveChainExecutor): ChainAdapter {
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
    case 'live': {
      if (config.mode === 'MAINNET') {
        return new UnavailableChainAdapter('MAINNET is refused. No mainnet signing or transfer path exists in this build.');
      }
      if (config.mode !== 'LIVE_TESTNET') {
        return new UnavailableChainAdapter(
          `CHAIN_ADAPTER=live is only allowed with MEND_MODE=LIVE_TESTNET (current: ${config.mode}).`,
        );
      }
      if (!config.chain.keysFile) {
        return new UnavailableChainAdapter(
          'CHAIN_ADAPTER=live requires MEND_TESTNET_KEYS_FILE pointing outside the repository. No action is signed.',
        );
      }
      const executor = chain ?? new NearLiveChain(config.chain);
      return new LiveRpcChainAdapter(executor, config.chain);
    }
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
