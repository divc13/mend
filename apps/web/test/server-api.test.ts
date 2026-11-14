import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { CASE_BY_ID } from '../src/lib/fixtures';
import {
  loadAsset,
  loadCase,
  loadCases,
  normalizeCaseListPayload,
  normalizeCasePayload,
} from '../src/lib/server-api';
import type { CaseBundle } from '../src/lib/types';

const BENCH_ID = 'WO-BENCH-001-0001';
const BENCH = CASE_BY_ID[BENCH_ID];

function requireBench(): CaseBundle {
  assert.ok(BENCH, 'expected the bench fixture');
  return BENCH;
}

function liveBench(): CaseBundle {
  return {
    ...requireBench(),
    mode: 'LIVE_TESTNET',
    title: 'Live Riverside Park bench',
    summary: 'Live case served by the public API.',
  };
}

function minimalBundle(id = 'WO-LIVE-001-0001'): Record<string, unknown> {
  return {
    id,
    assetId: 'LIVE-001',
    title: 'Live case',
    summary: 'Live summary from the API.',
    status: 'FUNDED',
    mode: 'LIVE_TESTNET',
    budgetMicro: '1000000',
    scope: 'Replace the broken part.',
    scopeHash: 'a'.repeat(64),
    daoApproval: {
      id: 'dao-1',
      daoAccount: 'mend-dao.testnet',
      proposalId: '1',
      budgetMicro: '1000000',
      contractorRoster: ['contractor-a.testnet'],
      inspectorRoster: ['inspector.testnet'],
      policyHash: 'b'.repeat(64),
      state: 'APPROVED',
    },
    policyVersion: 'mend-bid-policy-v1',
    policyWeightsBps: { price: 4500, warranty: 2500, duration: 2000, materials: 1000 },
    policyHash: 'b'.repeat(64),
    fundingToken: 'mend-usdc.testnet',
    reopenCount: 0,
    createdAt: '2026-11-10T08:00:00.000Z',
    updatedAt: '2026-11-10T09:00:00.000Z',
    reports: [],
    commitments: [],
    reveals: [],
    evidence: [],
    inspections: [],
    escrow: {
      token: 'mend-usdc.testnet',
      fundedMicro: '1000000',
      refundedMicro: '0',
      completionPaidMicro: '0',
      holdbackHeldMicro: '0',
      holdbackReleasedMicro: '0',
    },
    payments: [],
    attestations: [],
    events: [],
  };
}

async function withMockApi(
  handler: (request: http.IncomingMessage, response: http.ServerResponse) => void,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as AddressInfo;
  const previous = process.env.MEND_API_BASE_URL;
  process.env.MEND_API_BASE_URL = `http://127.0.0.1:${address.port}`;
  try {
    await run(process.env.MEND_API_BASE_URL);
  } finally {
    if (previous === undefined) delete process.env.MEND_API_BASE_URL;
    else process.env.MEND_API_BASE_URL = previous;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function json(response: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(payload);
}

test('normalises a bare CaseBundle from /v1/cases/:id', () => {
  const caseData = normalizeCasePayload(liveBench(), BENCH_ID);
  assert.ok(caseData);
  assert.equal(caseData.id, BENCH_ID);
  assert.equal(caseData.mode, 'LIVE_TESTNET');
  assert.equal(caseData.title, 'Live Riverside Park bench');
  assert.equal(caseData.escrow.fundedMicro, '100000000');
});

test('accepts case and data envelopes but rejects mismatched ids', () => {
  const bundled = minimalBundle();
  assert.ok(normalizeCasePayload({ case: bundled }));
  assert.ok(normalizeCasePayload({ data: { case: bundled } }));
  assert.equal(normalizeCasePayload({ case: bundled }, 'WO-OTHER-001-0001'), null);
});

test('rejects /v1/cases summaries that omit the full bundle', () => {
  const summary = {
    id: BENCH_ID,
    assetId: 'BENCH-001',
    title: 'Bench',
    summary: 'Summary only',
    status: 'CLOSED',
    mode: 'REPLAY',
    budgetMicro: '100000000',
    reportCount: 2,
    evidenceCount: 1,
  };
  assert.equal(normalizeCasePayload(summary), null);
  assert.equal(normalizeCaseListPayload([summary]), null);
});

test('normalises missing optional API fields without inventing fixture values', () => {
  const caseData = normalizeCasePayload(minimalBundle());
  assert.ok(caseData);
  assert.deepEqual(caseData.reports, []);
  assert.equal(caseData.score, undefined);
  assert.equal(caseData.cluster, undefined);
  assert.equal(caseData.intent.id, 'INTENT-UNAVAILABLE');
  assert.equal(caseData.mode, 'LIVE_TESTNET');
});

test('falls back to fixtures when MEND_API_BASE_URL is absent', async () => {
  const previous = process.env.MEND_API_BASE_URL;
  delete process.env.MEND_API_BASE_URL;
  try {
    const result = await loadCase(BENCH_ID);
    assert.equal(result.source, 'fixture');
    assert.equal(result.apiConfigured, false);
    assert.equal(result.caseData?.id, BENCH_ID);
    assert.match(result.fallbackReason ?? '', /not configured/i);
  } finally {
    if (previous !== undefined) process.env.MEND_API_BASE_URL = previous;
  }
});

test('loads a live case and reports a 404 fallback without pretending it is live', async () => {
  await withMockApi(
    (request, response) => {
      const url = request.url ?? '';
      if (url === `/v1/cases/${BENCH_ID}`) {
        json(response, 200, liveBench());
        return;
      }
      if (url === '/v1/cases/WO-RACK-002-0001') {
        json(response, 500, { error: { code: 'INTERNAL' } });
        return;
      }
      json(response, 404, { error: { code: 'NOT_FOUND' } });
    },
    async () => {
      const live = await loadCase(BENCH_ID);
      assert.equal(live.source, 'api');
      assert.equal(live.caseData?.title, 'Live Riverside Park bench');

      const missing = await loadCase('WO-MISSING-001-0001');
      assert.equal(missing.source, 'fixture');
      assert.equal(missing.caseData, undefined);
      assert.match(missing.fallbackReason ?? '', /no case record/i);

      const failed = await loadCase('WO-RACK-002-0001');
      assert.equal(failed.source, 'fixture');
      assert.equal(failed.caseData?.id, 'WO-RACK-002-0001');
      assert.match(failed.fallbackReason ?? '', /HTTP 500/i);
    },
  );
});

test('hydrates asset cases from the list summaries through case detail', async () => {
  await withMockApi(
    (request, response) => {
      const url = request.url ?? '';
      if (url === '/v1/cases/by-asset/BENCH-001') {
        json(response, 200, {
          asset: {
            id: 'BENCH-001',
            publicDescription: 'Live asset description',
            assetType: 'bench',
            publicLocation: {
              label: 'Riverside Park, bench near east gate',
              coarseLat: 52.52,
              coarseLng: 13.405,
            },
            createdAt: '2026-11-10T08:00:00.000Z',
          },
          cases: [
            {
              id: BENCH_ID,
              assetId: 'BENCH-001',
              status: 'CLOSED',
              mode: 'LIVE_TESTNET',
              budgetMicro: '100000000',
              reportCount: 2,
              evidenceCount: 1,
            },
          ],
        });
        return;
      }
      if (url === `/v1/cases/${BENCH_ID}`) {
        json(response, 200, liveBench());
        return;
      }
      if (url === '/v1/cases/by-asset/EMPTY-001') {
        json(response, 200, {
          asset: {
            id: 'EMPTY-001',
            publicDescription: 'Live empty asset',
            assetType: 'other',
            publicLocation: { label: 'Somewhere', coarseLat: 1, coarseLng: 2 },
            createdAt: '2026-11-10T08:00:00.000Z',
          },
          cases: [],
        });
        return;
      }
      json(response, 404, { error: { code: 'NOT_FOUND' } });
    },
    async () => {
      const result = await loadAsset('BENCH-001');
      assert.equal(result.source, 'api');
      assert.equal(result.asset?.publicDescription, 'Live asset description');
      assert.equal(result.asset?.repairCount, 1);
      assert.equal(result.cases.length, 1);
      assert.equal(result.cases[0]?.title, 'Live Riverside Park bench');

      const empty = await loadAsset('EMPTY-001');
      assert.equal(empty.source, 'api');
      assert.equal(empty.asset?.id, 'EMPTY-001');
      assert.deepEqual(empty.cases, []);
    },
  );
});

test('hydrates the public case list and falls back when the API is unreachable', async () => {
  await withMockApi(
    (request, response) => {
      const url = request.url ?? '';
      if (url === '/v1/cases') {
        json(response, 200, [
          {
            id: BENCH_ID,
            assetId: 'BENCH-001',
            status: 'CLOSED',
            mode: 'LIVE_TESTNET',
            budgetMicro: '100000000',
            reportCount: 2,
            evidenceCount: 1,
          },
        ]);
        return;
      }
      if (url === `/v1/cases/${BENCH_ID}`) {
        json(response, 200, liveBench());
        return;
      }
      json(response, 404, { error: { code: 'NOT_FOUND' } });
    },
    async () => {
      const result = await loadCases();
      assert.equal(result.source, 'api');
      assert.equal(result.cases.length, 1);
      assert.equal(result.cases[0]?.title, 'Live Riverside Park bench');
    },
  );

  const previous = process.env.MEND_API_BASE_URL;
  process.env.MEND_API_BASE_URL = 'http://127.0.0.1:1';
  try {
    const result = await loadCase(BENCH_ID);
    assert.equal(result.source, 'fixture');
    assert.equal(result.caseData?.id, BENCH_ID);
    assert.match(result.fallbackReason ?? '', /unreachable|did not respond/i);
  } finally {
    if (previous === undefined) delete process.env.MEND_API_BASE_URL;
    else process.env.MEND_API_BASE_URL = previous;
  }
});
