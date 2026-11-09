import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { PgRepository } from '../src/postgres.js';
import { runMigrations } from '../src/migrate.js';
import type { AssetRecord, AuditEventRecord, WorkOrderRecord } from '../src/types.js';

const databaseUrl = process.env.DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

const at = '2026-11-10T08:00:00.000Z';
const hash = (c: string) => c.repeat(64);

describePostgres('PgRepository (integration)', () => {
  let admin: Pool;
  let pool: Pool;
  let repo: PgRepository;
  let schema: string;

  const asset: AssetRecord = {
    id: 'BENCH-001',
    publicDescription: 'A bench',
    assetType: 'bench',
    publicLocation: { label: 'Park', coarseLat: 52.52, coarseLng: 13.405 },
    createdAt: at,
    isDemo: true,
  };

  const workOrder: WorkOrderRecord = {
    id: 'WO-BENCH-001-0001',
    assetId: 'BENCH-001',
    reportClusterId: 'CL-0001',
    scopeHash: hash('c'),
    daoApprovalId: 'dao-42',
    policyHash: hash('d'),
    budgetMicro: '100000000',
    status: 'DRAFT',
    mode: 'REPLAY',
    fundingToken: 'mend-usdc.testnet',
    reopenCount: 0,
    createdAt: at,
    updatedAt: at,
    isDemo: true,
  };

  beforeAll(async () => {
    admin = new Pool({ connectionString: databaseUrl });
    schema = `mend_test_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    await admin.query(`CREATE SCHEMA "${schema}"`);
    pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
    const migrations = await runMigrations(pool);
    expect(migrations.applied).toContain('001_init.sql');
    repo = PgRepository.fromPool(pool);
  });

  afterAll(async () => {
    await pool?.end();
    if (admin && schema) await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin?.end();
  });

  it('creates all core tables and applies migrations idempotently', async () => {
    const tables = await repo.listTablesForDiagnostics();
    for (const table of ['assets', 'reports', 'work_orders', 'escrow_accounts', 'audit_events', 'processed_events']) {
      expect(tables).toContain(table);
    }
    const again = await runMigrations(pool);
    expect(again.applied).toEqual([]);
    expect(again.skipped).toContain('001_init.sql');
  });

  it('persists records and enforces cross-row constraints', async () => {
    expect(await repo.nextSequence('report')).toBe(1);
    expect(await repo.nextSequence('report')).toBe(2);
    await repo.createAsset(asset);
    await repo.createCluster({
      id: 'CL-0001',
      reportIds: ['R-001'],
      confidenceBps: 9000,
      rationale: 'same asset',
      status: 'SUGGESTED',
      createdAt: at,
      isDemo: true,
    });
    await repo.createDaoApproval({
      id: 'dao-42',
      daoAccount: 'mend-dao.sputnikv2.testnet',
      proposalId: '42',
      budgetMicro: '100000000',
      contractorRoster: ['contractor-a.mend.testnet'],
      inspectorRoster: ['inspector.mend.testnet'],
      policyHash: hash('d'),
      state: 'APPROVED',
      approvedAt: at,
      isDemo: true,
    });
    await repo.createWorkOrder(workOrder);
    expect((await repo.getAsset('BENCH-001'))?.publicDescription).toBe('A bench');
    expect((await repo.getWorkOrder(workOrder.id))?.status).toBe('DRAFT');

    // Budget must be positive micro-units.
    await expect(
      repo.createWorkOrder({ ...workOrder, id: 'WO-BENCH-001-0002', budgetMicro: '-1' }),
    ).rejects.toThrow();
    // Unknown asset is rejected by the foreign key.
    await expect(
      repo.createWorkOrder({ ...workOrder, id: 'WO-RACK-002-0001', assetId: 'MISSING-999' }),
    ).rejects.toThrow();
  });

  it('rejects audit updates and deletes at the database level', async () => {
    const event: AuditEventRecord = {
      id: 'A-1',
      name: 'work_order_created',
      actor: 'steward',
      workOrderId: workOrder.id,
      at,
      data: { scopeHash: hash('c') },
    };
    await repo.appendAudit(event);
    const listed = await repo.listAudit({ workOrderId: workOrder.id });
    expect(listed).toHaveLength(1);
    await expect(pool.query("UPDATE audit_events SET actor = 'attacker' WHERE id = 'A-1'")).rejects.toThrow('append-only');
    await expect(pool.query("DELETE FROM audit_events WHERE id = 'A-1'")).rejects.toThrow('append-only');
    expect(await pool.query("SELECT count(*)::int AS n FROM audit_events")).toMatchObject({ rows: [{ n: 1 }] });
  });

  it('marks indexer events idempotently and stores cursors', async () => {
    expect(await repo.markEventProcessed('evt-1', 'replay')).toBe(true);
    expect(await repo.markEventProcessed('evt-1', 'replay')).toBe(false);
    await repo.setIndexerCursor('replay', 'cursor-9');
    expect(await repo.getIndexerCursor('replay')).toBe('cursor-9');
  });

  it('clears only demo data and preserves audit history', async () => {
    await repo.createAsset({ ...asset, id: 'RACK-002', isDemo: false });
    const auditBefore = (await repo.listAudit()).length;
    await repo.clearDemoData();
    expect(await repo.getAsset('BENCH-001')).toBeNull();
    expect(await repo.getWorkOrder(workOrder.id)).toBeNull();
    expect(await repo.getAsset('RACK-002')).not.toBeNull();
    expect((await repo.listAudit()).length).toBe(auditBefore);
  });
});
