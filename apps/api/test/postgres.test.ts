import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { PgRepository, runMigrations } from '@mend/db';
import type { AppConfig } from '../src/config.js';
import { loadConfig } from '../src/config.js';
import { auth, call, makeTestApp, type TestApp } from './helpers.js';

const databaseUrl = process.env.DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres('MEND API — Postgres repository integration', () => {
  let admin: Pool;
  let pool: Pool;
  let repo: PgRepository;
  let target: TestApp;
  let schema: string;

  beforeAll(async () => {
    admin = new Pool({ connectionString: databaseUrl });
    schema = `mend_api_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    await admin.query(`CREATE SCHEMA "${schema}"`);
    pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
    const migrations = await runMigrations(pool);
    expect(migrations.applied).toContain('001_init.sql');
    repo = PgRepository.fromPool(pool);
    const config: AppConfig = loadConfig({
      NODE_ENV: 'test',
      MEND_MODE: 'REPLAY',
      CHAIN_ADAPTER: 'replay',
      DEMO_RESET_ENABLED: 'true',
      DEMO_ADMIN_ACCOUNT: 'demo-admin.mend.testnet',
      EVIDENCE_URL_SECRET: 'postgres-test-secret',
      EVIDENCE_DIR: '/tmp/mend-api-pg-evidence',
      PUBLIC_BASE_URL: 'http://127.0.0.1:4010',
    });
    target = await makeTestApp({ repo, config });
  });

  afterAll(async () => {
    await target?.close();
    if (admin && schema) await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin?.end();
  });

  it('serves the API, persists demo data and honours constraints', async () => {
    const reset = await call(target.app, 'POST', '/v1/demo/reset', {
      headers: auth('ADMIN'),
      body: { scenario: 'failedDurability' },
    });
    expect(reset.status).toBe(200);

    const assets = await call(target.app, 'GET', '/v1/assets');
    expect(assets.status).toBe(200);
    expect(assets.body).toHaveLength(2);

    const workOrder = await call(target.app, 'GET', '/v1/work-orders/WO-BENCH-001-0001');
    expect(workOrder.status).toBe(200);
    expect(workOrder.body.status).toBe('WARRANTY_REOPENED');

    const warranty = await call(target.app, 'GET', '/v1/work-orders/WO-BENCH-001-0001/warranty');
    expect(warranty.body.cases[0].state).toBe('OPEN');
    expect(warranty.body.durabilityIntervalMinutes).toBe(2);

    const report = await call(target.app, 'POST', '/v1/reports', {
      body: {
        assetId: 'BENCH-001',
        description: 'Postgres-backed walletless report',
        publicLocation: { label: 'Park', coarseLat: 52.52, coarseLng: 13.405 },
        preciseLocation: { lat: 52.5201, lng: 13.4051 },
      },
    });
    expect(report.status).toBe(201);
    expect(report.body.id).toBe('R-003');
    const privateLocation = await call(target.app, 'GET', '/v1/reports/R-003/private-location', {
      headers: auth('STEWARD'),
    });
    expect(privateLocation.status).toBe(200);
    expect(privateLocation.body.preciseLocation.lat).toBeCloseTo(52.5201);

    const started = await call(target.app, 'POST', '/v1/work-orders/WO-BENCH-001-0001/actions/start_work', {
      headers: auth('CONTRACTOR', 'contractor-b.mend.testnet'),
      body: {},
    });
    expect(started.status).toBe(200);
    expect(started.body.workOrder.status).toBe('IN_PROGRESS');
    expect(started.body.command.state).toBe('SUCCESS');
    expect(started.body.command.realTransaction).toBe(false);

    const audit = await call(target.app, 'GET', '/v1/audit', { headers: auth('ADMIN') });
    expect(audit.status).toBe(200);
    expect(audit.body.events.some((event: any) => event.name === 'work_started')).toBe(true);
  });
});
