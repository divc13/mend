import assert from 'node:assert/strict';
import test from 'node:test';
import { CASE_BY_ID } from '../src/lib/fixtures';
import { metricsForCases } from '../src/lib/case-metrics';
import { caseSourceLabel, caseSourceTone } from '../src/lib/case-source';
import { summarizeActionResult, type WorkOrderActionPayload } from '../src/lib/work-order-actions';

const BENCH = CASE_BY_ID['WO-BENCH-001-0001'];

function requireBench() {
  assert.ok(BENCH, 'expected the bench fixture');
  return BENCH;
}

test('metrics are recomputed from the supplied live records, not fixture totals', () => {
  const liveCase = { ...requireBench(), mode: 'LIVE_TESTNET' as const, reopenCount: 0 };
  const metrics = metricsForCases([liveCase]);

  assert.equal(metrics.cases, 1);
  assert.equal(metrics.assets, 1);
  assert.deepEqual(metrics.statusDistribution, [{ status: liveCase.status, count: 1 }]);
  assert.equal(metrics.fundedMicro, liveCase.escrow.fundedMicro);
  assert.equal(metrics.refundedMicro, liveCase.escrow.refundedMicro);
  assert.equal(metrics.completionPaidMicro, liveCase.escrow.completionPaidMicro);
  assert.equal(metrics.holdbackReleasedMicro, liveCase.escrow.holdbackReleasedMicro);
  assert.equal(metrics.holdbackHeldMicro, liveCase.escrow.holdbackHeldMicro);
  assert.equal(metrics.reports, liveCase.reports.length);
});

test('source labels never turn a fixture into live data', () => {
  assert.equal(caseSourceLabel('api', 'LIVE_TESTNET'), 'LIVE API · TESTNET');
  assert.equal(caseSourceLabel('api', 'REPLAY'), 'LIVE API · REPLAY RECORD');
  assert.equal(
    caseSourceLabel('fixture', 'LIVE_TESTNET', true),
    'REPLAY / SIMULATION · FIXTURE FALLBACK',
  );
  assert.equal(caseSourceLabel('fixture', 'REPLAY', false), 'REPLAY / SIMULATION');
  assert.equal(caseSourceTone('fixture', 'LIVE_TESTNET'), 'warning');
  assert.equal(caseSourceTone('api', 'REPLAY'), 'neutral');
});

test('action summaries distinguish applied API state from a real chain transaction', () => {
  const base: WorkOrderActionPayload = { applied: true, command: { state: 'SUCCESS' } };

  const repositoryOnly = summarizeActionResult(
    { ok: true, status: 200, source: 'api', data: base },
    'award',
  );
  assert.equal(repositoryOnly.applied, true);
  assert.equal(repositoryOnly.realTransaction, false);
  assert.equal(repositoryOnly.tone, 'warning');
  assert.match(repositoryOnly.message, /no real transaction/i);
  assert.doesNotMatch(repositoryOnly.message, /live testnet award applied/i);

  const live = summarizeActionResult(
    {
      ok: true,
      status: 200,
      source: 'api',
      data: {
        applied: true,
        command: {
          state: 'SUCCESS',
          realTransaction: true,
          txHash: '3HzfWvJci4Drt1YMsx4Ei6NTgzsZYR3jNufAWYhWQ6Q2',
        },
      },
    },
    'award',
  );
  assert.equal(live.realTransaction, true);
  assert.equal(live.txHash, '3HzfWvJci4Drt1YMsx4Ei6NTgzsZYR3jNufAWYhWQ6Q2');
  assert.equal(live.tone, 'positive');

  const notApplied = summarizeActionResult(
    {
      ok: true,
      status: 202,
      source: 'api',
      data: { applied: false, command: { state: 'PENDING', realTransaction: false } },
    },
    'award',
  );
  assert.equal(notApplied.applied, false);
  assert.equal(notApplied.tone, 'warning');
  assert.match(notApplied.message, /did not apply/i);

  const rejected = summarizeActionResult(
    {
      ok: false,
      status: 403,
      code: 'FORBIDDEN_ROLE',
      message: 'Role required',
      replayFallback: true,
    },
    'award',
  );
  assert.equal(rejected.ok, false);
  assert.equal(rejected.tone, 'danger');
  assert.match(rejected.message, /did not accept/i);
});
