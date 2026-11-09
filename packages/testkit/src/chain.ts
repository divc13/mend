import { sha256Hex, type WorkOrderMode } from '@mend/protocol';
import { fixedClock, type TestClock } from './clock.js';

export type FakeChainState = 'INTENT' | 'PENDING' | 'SUCCESS' | 'FAILED';
export type FakeChainOutcome = 'SUCCESS' | 'PENDING' | 'FAILED';

export const FAKE_CHAIN_LABEL = 'FAKE / TEST ONLY' as const;

export class FakeChainError extends Error {
  readonly code:
    | 'INVALID_INTENT'
    | 'UNKNOWN_COMMAND'
    | 'INVALID_TRANSITION'
    | 'DISHONEST_SUCCESS'
    | 'MISSING_TX_HASH';

  constructor(code: FakeChainError['code'], message: string) {
    super(message);
    this.name = 'FakeChainError';
    this.code = code;
  }
}

export interface FakeChainIntent {
  id: string;
  action: string;
  method: string;
  args?: Record<string, unknown>;
  mode?: WorkOrderMode;
}

export interface FakeChainResult {
  state: FakeChainState;
  txHash?: string;
  errorCode?: string;
  errorMessage?: string;
  /** Always false: a fake adapter never claims a real transaction. */
  realTransaction: false;
  label: string;
}

export interface FakeChainCommand extends FakeChainResult {
  id: string;
  action: string;
  method: string;
  args: Record<string, unknown>;
  mode: WorkOrderMode;
  createdAt: string;
  updatedAt: string;
}

/**
 * The single honesty invariant these fakes enforce: SUCCESS requires a
 * non-empty transaction hash. Callers can use this on any adapter result.
 */
export function assertHonestChainResult(result: FakeChainResult): void {
  if (result.realTransaction !== false) {
    throw new FakeChainError('DISHONEST_SUCCESS', 'Fake chain adapters must report realTransaction: false');
  }
  if (result.state === 'SUCCESS' && (typeof result.txHash !== 'string' || result.txHash.trim() === '')) {
    throw new FakeChainError('DISHONEST_SUCCESS', 'SUCCESS requires a non-empty transaction hash');
  }
}

export interface InMemoryChainAdapterOptions {
  /** Final state produced by `submit()`. Defaults to SUCCESS. */
  outcome?: FakeChainOutcome;
  clock?: TestClock;
  label?: string;
}

function cloneCommand(command: FakeChainCommand): FakeChainCommand {
  return { ...command, args: structuredClone(command.args) };
}

/**
 * In-memory chain command adapter. Every submission is first recorded as
 * INTENT; `submit()` then applies the configured outcome. Commands can also be
 * advanced explicitly through `markPending`, `markSuccess` and `markFailed`.
 *
 * A SUCCESS command always carries a deterministic `fake:<sha256>` hash, and the
 * adapter labels every result as fake. It never claims a real transaction.
 */
export class InMemoryChainCommandAdapter {
  readonly kind = 'fake-chain' as const;
  readonly available = true;

  private readonly outcome: FakeChainOutcome;
  private readonly clock: TestClock;
  private readonly label: string;
  private readonly commands = new Map<string, FakeChainCommand>();

  constructor(options: InMemoryChainAdapterOptions = {}) {
    this.outcome = options.outcome ?? 'SUCCESS';
    this.clock = options.clock ?? fixedClock();
    this.label = options.label ?? FAKE_CHAIN_LABEL;
  }

  private now(): string {
    return this.clock.now().toISOString();
  }

  private transactionHash(intent: FakeChainIntent): string {
    return `fake:${sha256Hex(
      ['MEND_FAKE_CHAIN_V1', intent.id, intent.action, intent.method].join('|'),
    )}`;
  }

  private require(intentId: string): FakeChainCommand {
    const command = this.commands.get(intentId);
    if (!command) throw new FakeChainError('UNKNOWN_COMMAND', `unknown fake chain command: ${intentId}`);
    return command;
  }

  private transition(intentId: string, patch: Partial<FakeChainCommand>): FakeChainCommand {
    const current = this.require(intentId);
    if (current.state === 'SUCCESS' || current.state === 'FAILED') {
      throw new FakeChainError(
        'INVALID_TRANSITION',
        `command ${intentId} is already terminal (${current.state})`,
      );
    }
    const updated: FakeChainCommand = {
      ...current,
      ...patch,
      realTransaction: false,
      label: this.label,
      updatedAt: this.now(),
    };
    assertHonestChainResult(updated);
    this.commands.set(intentId, updated);
    return cloneCommand(updated);
  }

  /** Records an INTENT without broadcasting. */
  recordIntent(intent: FakeChainIntent): FakeChainCommand {
    if (!intent.id || !intent.action || !intent.method) {
      throw new FakeChainError('INVALID_INTENT', 'fake chain intents require id, action and method');
    }
    if (this.commands.has(intent.id)) {
      throw new FakeChainError('INVALID_INTENT', `duplicate fake chain intent id: ${intent.id}`);
    }
    const at = this.now();
    const command: FakeChainCommand = {
      id: intent.id,
      action: intent.action,
      method: intent.method,
      args: structuredClone(intent.args ?? {}),
      state: 'INTENT',
      mode: intent.mode ?? 'REPLAY',
      createdAt: at,
      updatedAt: at,
      realTransaction: false,
      label: this.label,
    };
    this.commands.set(intent.id, command);
    return cloneCommand(command);
  }

  markPending(intentId: string, reason = 'broadcast outcome is unknown; reconciliation required'): FakeChainCommand {
    return this.transition(intentId, { state: 'PENDING', errorMessage: reason });
  }

  markSuccess(intentId: string, txHash?: string): FakeChainCommand {
    const current = this.require(intentId);
    const hash = txHash ?? this.transactionHash(current);
    if (hash.trim() === '') {
      throw new FakeChainError('MISSING_TX_HASH', 'refusing SUCCESS without a transaction hash');
    }
    return this.transition(intentId, {
      state: 'SUCCESS',
      txHash: hash,
      errorCode: undefined,
      errorMessage: undefined,
    });
  }

  markFailed(intentId: string, reason = 'simulated chain failure'): FakeChainCommand {
    return this.transition(intentId, {
      state: 'FAILED',
      errorCode: 'SIMULATED_FAILURE',
      errorMessage: reason,
      txHash: undefined,
    });
  }

  /** Records the intent, then applies the adapter's configured outcome. */
  async submit(intent: FakeChainIntent): Promise<FakeChainCommand> {
    this.recordIntent(intent);
    switch (this.outcome) {
      case 'SUCCESS':
        return this.markSuccess(intent.id);
      case 'PENDING':
        return this.markPending(intent.id);
      case 'FAILED':
        return this.markFailed(intent.id);
    }
  }

  getCommand(intentId: string): FakeChainCommand | null {
    const command = this.commands.get(intentId);
    return command ? cloneCommand(command) : null;
  }

  listCommands(): FakeChainCommand[] {
    return [...this.commands.values()].map(cloneCommand);
  }
}
