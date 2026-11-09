import { describe, expect, it } from 'vitest';
import {
  FAKE_CHAIN_LABEL,
  FakeChainError,
  InMemoryChainCommandAdapter,
  assertHonestChainResult,
  fixedClock,
} from '../src/index.js';

const intent = {
  id: 'CMD-0001',
  action: 'fund_work_order',
  method: 'fund_work_order',
  args: { workOrderId: 'WO-BENCH-001-0001' },
  mode: 'REPLAY' as const,
};

describe('in-memory chain adapter honesty', () => {
  it('never reports SUCCESS without a transaction hash', () => {
    const adapter = new InMemoryChainCommandAdapter({ outcome: 'SUCCESS' });
    return adapter.submit(intent).then((command) => {
      expect(command.state).toBe('SUCCESS');
      expect(command.txHash).toMatch(/^fake:[a-f0-9]{64}$/);
      expect(command.realTransaction).toBe(false);
      expect(command.label).toBe(FAKE_CHAIN_LABEL);
      expect(() => assertHonestChainResult(command)).not.toThrow();
    });
  });

  it('rejects a hashless success at the boundary', () => {
    expect(() =>
      assertHonestChainResult({ state: 'SUCCESS', realTransaction: false, label: FAKE_CHAIN_LABEL }),
    ).toThrow(FakeChainError);
    expect(() =>
      assertHonestChainResult({
        state: 'SUCCESS',
        txHash: '   ',
        realTransaction: false,
        label: FAKE_CHAIN_LABEL,
      }),
    ).toThrow(/hash/);
  });

  it('refuses a real transaction claim on a fake adapter', () => {
    expect(() =>
      assertHonestChainResult({
        state: 'FAILED',
        realTransaction: true as unknown as false,
        label: FAKE_CHAIN_LABEL,
      }),
    ).toThrow(/realTransaction/);
  });

  it('records INTENT, then advances through PENDING to SUCCESS', async () => {
    const clock = fixedClock('2026-11-10T08:40:00.000Z');
    const adapter = new InMemoryChainCommandAdapter({ clock });
    const recorded = adapter.recordIntent(intent);
    expect(recorded.state).toBe('INTENT');
    expect(recorded.txHash).toBeUndefined();

    const pending = adapter.markPending(intent.id);
    expect(pending.state).toBe('PENDING');
    expect(pending.txHash).toBeUndefined();
    clock.advance(1_000);

    const success = adapter.markSuccess(intent.id);
    expect(success.state).toBe('SUCCESS');
    expect(success.txHash).toMatch(/^fake:/);
    expect(success.updatedAt).toBe('2026-11-10T08:40:01.000Z');
    expect(adapter.listCommands()).toHaveLength(1);
  });

  it('reports PENDING and FAILED honestly', async () => {
    const pending = new InMemoryChainCommandAdapter({ outcome: 'PENDING' });
    const pendingCommand = await pending.submit(intent);
    expect(pendingCommand.state).toBe('PENDING');
    expect(pendingCommand.txHash).toBeUndefined();

    const failing = new InMemoryChainCommandAdapter({ outcome: 'FAILED' });
    const failedCommand = await failing.submit(intent);
    expect(failedCommand.state).toBe('FAILED');
    expect(failedCommand.errorCode).toBe('SIMULATED_FAILURE');
    expect(failedCommand.errorMessage).toMatch(/simulated/);
    expect(failedCommand.txHash).toBeUndefined();
  });

  it('produces deterministic hashes and blocks invalid transitions', async () => {
    const first = await new InMemoryChainCommandAdapter().submit(intent);
    const second = await new InMemoryChainCommandAdapter().submit(intent);
    expect(first.txHash).toBe(second.txHash);

    const adapter = new InMemoryChainCommandAdapter();
    await adapter.submit(intent);
    expect(() => adapter.markFailed(intent.id)).toThrow(/terminal/);
    expect(() => adapter.recordIntent(intent)).toThrow(/duplicate/);
    expect(() => adapter.markSuccess('MISSING')).toThrow(/unknown/);
  });

  it('returns defensive copies of stored commands', async () => {
    const adapter = new InMemoryChainCommandAdapter();
    const command = await adapter.submit(intent);
    command.args.workOrderId = 'TAMPERED';
    expect(adapter.getCommand(intent.id)?.args.workOrderId).toBe('WO-BENCH-001-0001');
  });
});
