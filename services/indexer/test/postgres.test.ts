import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { MemoryRepository, PgRepository, runMigrations } from '@mend/db';
import { ReplayHubEventSource } from '../src/events.js';
import { HubIndexer } from '../src/indexer.js';
import { publicStateHash } from '../src/read-model.js';

const databaseUrl = process.env.DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres('Hub indexer — Postgres read-model rebuild (integration)', () => {
  let admin: Pool;
  let pool: Pool;
  let repo: PgRepository;
  let schema: string;

  beforeAll(async () => {
    admin = new Pool({ connectionString: databaseUrl });
    schema = `mend_idx_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
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

  it('rebuilds from empty to the exact same public state as the in-memory indexer', async () => {
    const memory = new MemoryRepository();
    const memoryResult = await new HubIndexer(memory, new ReplayHubEventSource()).sync();

    const postgresIndexer = new HubIndexer(repo, new ReplayHubEventSource());
    const first = await postgresIndexer.rebuild();
    expect(first.processed).toBeGreaterThan(15);
    expect(first.publicStateHash).toBe(memoryResult.publicStateHash);

    const second = await postgresIndexer.rebuild();
    expect(second.publicStateHash).toBe(first.publicStateHash);

    const workOrder = await repo.getWorkOrder('WO-BENCH-001-0001');
    expect(workOrder?.status).toBe('CLOSED');
    expect(await repo.listPayments('WO-BENCH-001-0001')).toHaveLength(3);
    expect(await repo.listBidReveals('WO-BENCH-001-0001')).toHaveLength(3);
    expect(await publicStateHash(repo)).toBe(first.publicStateHash);

    const replay = await postgresIndexer.sync();
    expect(replay.processed).toBe(0);
    expect(replay.publicStateHash).toBe(first.publicStateHash);
  });
});
