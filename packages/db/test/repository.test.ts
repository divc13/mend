import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MemoryRepository } from '../src/memory.js';
import { MIGRATIONS_DIR } from '../src/migrate.js';
import type { AssetRecord, AuditEventRecord, ReportPrivateRecord, ReportRecord, WorkOrderRecord } from '../src/types.js';

const at = '2026-11-10T08:00:00.000Z';
const hash = (c: string) => c.repeat(64);

function asset(id = 'BENCH-001', isDemo = true): AssetRecord {
  return {
    id,
    publicDescription: 'A bench',
    assetType: 'bench',
    publicLocation: { label: 'Park', coarseLat: 52.52, coarseLng: 13.405 },
    createdAt: at,
    isDemo,
  };
}

function workOrder(id = 'WO-BENCH-001-0001', isDemo = true): WorkOrderRecord {
  return {
    id,
    assetId: 'BENCH-001',
    reportClusterId: 'CL-0001',
    scopeHash: hash('c'),
    daoApprovalId: 'dao-42',
    policyHash: hash('d'),
    budgetMicro: '100000000',
    status: 'AWARDED',
    mode: 'REPLAY',
    contractorId: 'contractor-b.mend.testnet',
    inspectorId: 'inspector.mend.testnet',
    fundingToken: 'mend-usdc.testnet',
    reopenCount: 0,
    createdAt: at,
    updatedAt: at,
    isDemo,
  };
}

function report(id = 'R-001', isDemo = true): ReportRecord {
  return {
    id,
    assetId: 'BENCH-001',
    description: 'Cracked seat',
    publicLocation: { label: 'Park', coarseLat: 52.52, coarseLng: 13.405 },
    exifStripped: true,
    status: 'SUBMITTED',
    createdAt: at,
    source: 'WALLETLESS',
    isDemo,
  };
}

describe('MemoryRepository', () => {
  it('allocates monotonic sequences per name', async () => {
    const repo = new MemoryRepository();
    expect(await repo.nextSequence('report')).toBe(1);
    expect(await repo.nextSequence('report')).toBe(2);
    expect(await repo.nextSequence('cluster')).toBe(1);
  });

  it('supports asset CRUD and isolates callers from stored objects', async () => {
    const repo = new MemoryRepository();
    const created = await repo.createAsset(asset());
    created.publicDescription = 'mutated by caller';
    expect((await repo.getAsset('BENCH-001'))?.publicDescription).toBe('A bench');
    const updated = await repo.updateAsset('BENCH-001', { publicDescription: 'Updated' });
    expect(updated?.publicDescription).toBe('Updated');
    expect(await repo.listAssets()).toHaveLength(1);
    expect(await repo.deleteAsset('BENCH-001')).toBe(true);
    expect(await repo.getAsset('BENCH-001')).toBeNull();
  });

  it('stores private report data out of band and finds reports by case-link hash', async () => {
    const repo = new MemoryRepository();
    await repo.createAsset(asset());
    await repo.createReport(report());
    const priv: ReportPrivateRecord = {
      reportId: 'R-001',
      preciseLocation: { lat: 52.520001, lng: 13.405001 },
      reporterCaseLink: 'case_7J2mQ9xLk4Pz1VbN',
      caseLinkHash: hash('e'),
    };
    await repo.createReportPrivate(priv);
    expect((await repo.getReportPrivate('R-001'))?.preciseLocation?.lat).toBeCloseTo(52.520001);
    const found = await repo.findReportByCaseLinkHash(hash('e'));
    expect(found?.id).toBe('R-001');
    // The public report record has no precise coordinates or private media key.
    const publicReport = await repo.getReport('R-001');
    expect(JSON.stringify(publicReport)).not.toContain('52.520001');
    expect(JSON.stringify(publicReport)).not.toContain('reporterCaseLink');
  });

  it('stores only testnet account/public-key onboarding metadata', async () => {
    const repo = new MemoryRepository();
    const created = await repo.createTestnetWallet({
      accountId: 'mend-wnew.testnet',
      publicKey: 'ed25519:11111111111111111111111111111111',
      network: 'testnet',
      createdAt: at,
      faucetCount: 0,
    });
    expect(created.accountId).toBe('mend-wnew.testnet');
    const updated = await repo.updateTestnetWallet('mend-wnew.testnet', {
      lastFaucetAt: at,
      faucetCount: 1,
    });
    expect(updated?.faucetCount).toBe(1);
    const stored = await repo.getTestnetWallet('mend-wnew.testnet');
    expect(stored?.publicKey).toBe('ed25519:11111111111111111111111111111111');
    expect(JSON.stringify(stored)).not.toContain('secretKey');
    expect(JSON.stringify(stored)).not.toContain('seedPhrase');
  });

  it('keeps audit events append-only in the interface and preserves order', async () => {
    const repo = new MemoryRepository();
    const events: AuditEventRecord[] = [
      { id: 'A-1', name: 'work_order_created', actor: 'steward', at, data: { a: 1 } },
      { id: 'A-2', name: 'work_order_funded', actor: 'sponsor', at, data: { b: 2 } },
    ];
    for (const event of events) await repo.appendAudit(event);
    const listed = await repo.listAudit();
    expect(listed.map((e) => e.id)).toEqual(['A-1', 'A-2']);
    expect(repo.auditCount()).toBe(2);
    // There is deliberately no update/delete method on the repository contract.
    expect('updateAudit' in repo).toBe(false);
    expect('deleteAudit' in repo).toBe(false);
  });

  it('rolls back a failed transaction', async () => {
    const repo = new MemoryRepository();
    await expect(
      repo.transaction(async (tx) => {
        await tx.createAsset(asset());
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await repo.listAssets()).toHaveLength(0);
  });

  it('deletes only demo data and leaves non-demo rows and audit history intact', async () => {
    const repo = new MemoryRepository();
    await repo.createAsset(asset('BENCH-001', true));
    await repo.createAsset(asset('RACK-002', false));
    await repo.createWorkOrder(workOrder());
    await repo.createWorkOrder(workOrder('WO-RACK-002-0001', false));
    await repo.appendAudit({ id: 'A-1', name: 'work_order_created', actor: 'steward', at, data: {} });
    await repo.clearDemoData();
    expect(await repo.getAsset('BENCH-001')).toBeNull();
    expect(await repo.getWorkOrder('WO-BENCH-001-0001')).toBeNull();
    expect(await repo.getAsset('RACK-002')).not.toBeNull();
    expect(await repo.getWorkOrder('WO-RACK-002-0001')).not.toBeNull();
    expect(repo.auditCount()).toBe(1);
  });

  it('records indexer idempotency keys and cursors', async () => {
    const repo = new MemoryRepository();
    expect(await repo.markEventProcessed('evt-1', 'replay')).toBe(true);
    expect(await repo.markEventProcessed('evt-1', 'replay')).toBe(false);
    await repo.setIndexerCursor('replay', 'cursor-9');
    expect(await repo.getIndexerCursor('replay')).toBe('cursor-9');
    await repo.resetIndexerState('replay');
    expect(await repo.getIndexerCursor('replay')).toBeNull();
    expect(await repo.markEventProcessed('evt-1', 'replay')).toBe(true);
  });
});

describe('SQL migration', () => {
  it('defines every PLAN §3 core record, constraints, indexes and append-only audit trigger', async () => {
    const sql = await readFile(path.join(MIGRATIONS_DIR, '001_init.sql'), 'utf8');
    const tables = [
      'assets', 'reports', 'report_private', 'report_clusters', 'work_orders', 'dao_approvals',
      'bid_commitments', 'bid_reveals', 'score_executions', 'evidence_packages', 'evidence_objects',
      'inspections', 'escrow_accounts', 'payments', 'warranty_cases', 'agent_identities',
      'attestations', 'intent_quotes', 'intent_executions', 'audit_events', 'chain_commands',
      'triage_suggestions', 'processed_events', 'indexer_cursors', 'schema_migrations',
    ];
    for (const table of tables) {
      expect(sql, `missing table ${table}`).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(sql).toContain('audit_events is append-only');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON audit_events');
    expect(sql).toContain('can_release_escrow = false');
    expect(sql).toContain('CHECK (state <> \'SUCCESS\' OR tx_hash IS NOT NULL)');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_work_orders_status');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_attestations_subject');
  });

  it('ships a documented local-only down migration', async () => {
    const down = await readFile(path.join(MIGRATIONS_DIR, '001_init.down.sql'), 'utf8');
    expect(down).toContain('LOCAL DEVELOPMENT ONLY');
    expect(down).toContain('DROP TABLE IF EXISTS work_orders');
  });
});
