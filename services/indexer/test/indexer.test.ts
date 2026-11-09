import { describe, expect, it } from 'vitest';
import { MemoryRepository } from '@mend/db';
import { createEventSource, NearLiveRpcEventSource, ReplayHubEventSource, replayEvents } from '../src/events.js';
import { HubIndexer } from '../src/indexer.js';
import { publicStateHash, publicStateSnapshot } from '../src/read-model.js';

describe('Hub event replay source', () => {
  it('provides a deterministic, uniquely keyed lifecycle stream with monotonic cursors', async () => {
    const first = replayEvents();
    const second = replayEvents();
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(15);
    expect(new Set(first.map((event) => event.key)).size).toBe(first.length);
    expect(first[0]?.name).toBe('work_order_created');
    expect(first.at(-1)?.name).toBe('durability_passed');
    expect(first.map((event) => event.cursor)).toEqual(
      first.map((_, index) => `evt-${String(index + 1).padStart(4, '0')}`),
    );
    for (let index = 1; index < first.length; index += 1) {
      expect(Date.parse(first[index]!.timestamp)).toBeGreaterThanOrEqual(Date.parse(first[index - 1]!.timestamp));
    }

    const source = new ReplayHubEventSource(first, 4);
    const pages = [];
    let cursor: string | null = null;
    for (;;) {
      const batch = await source.fetch(cursor);
      pages.push(batch.events.length);
      cursor = batch.nextCursor;
      if (!batch.hasMore) break;
    }
    expect(pages.reduce((sum, value) => sum + value, 0)).toBe(first.length);
    expect(pages[0]).toBe(4);
  });

  it('defaults to replay and labels a live RPC source unavailable', async () => {
    const source = createEventSource({});
    expect(source.name).toBe('replay');
    expect(source.available).toBe(true);

    const live = createEventSource({ INDEXER_SOURCE: 'live-rpc', NEAR_RPC_URL: 'https://rpc.testnet.near.org', HUB_ACCOUNT: 'mend-hub.testnet' });
    expect(live).toBeInstanceOf(NearLiveRpcEventSource);
    expect(live.available).toBe(false);
    expect(live.unavailableReason).toContain('not activated');
    await expect(live.fetch()).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    const indexer = new HubIndexer(new MemoryRepository(), live);
    await expect(indexer.sync()).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
  });
});

describe('Hub indexer read model', () => {
  it('applies the lifecycle, settles escrow exactly and is idempotent on replay', async () => {
    const repo = new MemoryRepository();
    const events = replayEvents();
    const source = new ReplayHubEventSource(events, 4);
    const indexer = new HubIndexer(repo, source);

    const first = await indexer.sync();
    expect(first.processed).toBe(events.length);
    expect(first.skipped).toBe(0);
    expect(first.cursor).toBe(`evt-${String(events.length).padStart(4, '0')}`);

    const workOrder = await repo.getWorkOrder('WO-BENCH-001-0001');
    expect(workOrder?.status).toBe('CLOSED');
    expect(workOrder?.contractorId).toBe('contractor-b.mend.testnet');
    expect(workOrder?.awardedBidId).toBe('BID-B-BENCH-001');

    const escrow = await repo.getEscrow('WO-BENCH-001-0001');
    expect(escrow).toMatchObject({
      fundedMicro: '100000000',
      refundedMicro: '20000000',
      completionPaidMicro: '72000000',
      holdbackHeldMicro: '0',
      holdbackReleasedMicro: '8000000',
    });
    const accounted = ['refundedMicro', 'completionPaidMicro', 'holdbackHeldMicro', 'holdbackReleasedMicro']
      .map((key) => BigInt((escrow as unknown as Record<string, string>)[key]!))
      .reduce((sum, value) => sum + value, 0n);
    expect(accounted).toBe(100000000n);

    expect(await repo.listBidCommitments('WO-BENCH-001-0001')).toHaveLength(3);
    expect(await repo.listBidReveals('WO-BENCH-001-0001')).toHaveLength(3);
    expect((await repo.listPayments('WO-BENCH-001-0001')).map((p) => p.kind).sort()).toEqual([
      'COMPLETION', 'HOLDBACK', 'REFUND',
    ]);
    expect(await repo.listInspections('WO-BENCH-001-0001')).toHaveLength(2);
    expect(await repo.listEvidencePackages('WO-BENCH-001-0001')).toHaveLength(1);
    const scores = await repo.listScoreExecutions('WO-BENCH-001-0001');
    expect(scores).toHaveLength(1);
    expect(scores[0]?.ranking[0]).toMatchObject({ bidId: 'BID-B-BENCH-001', scoreBps: 9270 });
    expect(scores[0]?.verified).toBe(false);
    expect(await repo.listAttestationsBySubject(scores[0]!.outputHash)).toHaveLength(1);

    const snapshotBefore = JSON.stringify(await publicStateSnapshot(repo));
    const second = await indexer.sync();
    expect(second.processed).toBe(0);
    expect(second.skipped).toBe(0);
    expect(second.publicStateHash).toBe(first.publicStateHash);
    expect(JSON.stringify(await publicStateSnapshot(repo))).toBe(snapshotBefore);

    // Force the same events through again: processed keys make every event a skip.
    await repo.setIndexerCursor('replay', 'evt-0000');
    const third = await indexer.sync();
    expect(third.processed).toBe(0);
    expect(third.skipped).toBe(events.length);
    expect(third.publicStateHash).toBe(first.publicStateHash);
    expect(JSON.stringify(await publicStateSnapshot(repo))).toBe(snapshotBefore);
  });

  it('rebuilds from an empty read model and produces identical public state', async () => {
    const target = new MemoryRepository();
    await target.createAsset({
      id: 'JUNK-999',
      publicDescription: 'stale read-model row',
      assetType: 'other',
      publicLocation: { label: 'stale', coarseLat: 0, coarseLng: 0 },
      createdAt: '2026-01-01T00:00:00.000Z',
      isDemo: false,
    });
    await target.appendAudit({
      id: 'A-00001',
      name: 'audit_survives',
      actor: 'test',
      at: '2026-01-01T00:00:00.000Z',
      data: {},
    });

    const first = await new HubIndexer(target, new ReplayHubEventSource()).rebuild();
    expect(first.rebuilt).toBe(true);
    expect(await target.getAsset('JUNK-999')).toBeNull();
    expect((await target.listAudit()).map((event) => event.id)).toEqual(['A-00001']);
    const firstHash = await publicStateHash(target);
    expect(firstHash).toBe(first.publicStateHash);

    const second = await new HubIndexer(target, new ReplayHubEventSource()).rebuild();
    expect(second.publicStateHash).toBe(firstHash);

    const fresh = new MemoryRepository();
    const freshResult = await new HubIndexer(fresh, new ReplayHubEventSource()).sync();
    expect(freshResult.publicStateHash).toBe(firstHash);
    expect(await publicStateSnapshot(fresh)).toEqual(await publicStateSnapshot(target));
  });
});
