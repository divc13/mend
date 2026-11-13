import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCOUNTS,
  ASSET_BY_ID,
  CASE_BY_ID,
  CASES,
  getPublicMetrics,
  totalForCase,
} from '../src/lib/fixtures';
import {
  REPORT_AREAS,
  REPORT_CATEGORIES,
  assetIdForReport,
  protocolCategoryFor,
} from '../src/lib/report-routing';

const PATH_CASE_ID = 'WO-PATH-001-0001';

function requirePathCase() {
  const caseData = CASE_BY_ID[PATH_CASE_ID];
  assert.ok(caseData, `expected ${PATH_CASE_ID} to exist`);
  return caseData;
}

test('pothole asset PATH-006 is present with the public path location', () => {
  const asset = ASSET_BY_ID['PATH-006'];
  assert.ok(asset, 'expected PATH-006 asset');
  assert.equal(asset.assetType, 'other');
  assert.equal(asset.publicLocation.label, 'Riverside path — north gate');
  assert.equal(asset.passportTokenId, 'PATH-006');

  const caseData = requirePathCase();
  assert.equal(caseData.assetId, 'PATH-006');
  assert.equal(caseData.status, 'CLOSED');
});

test('pothole case preserves exact 100/20/72/8 accounting', () => {
  const caseData = requirePathCase();

  assert.equal(caseData.budgetMicro, '100000000');
  assert.equal(caseData.winningBidMicro, '80000000');
  assert.equal(caseData.refundMicro, '20000000');
  assert.equal(caseData.completionPaymentMicro, '72000000');
  assert.equal(caseData.holdbackMicro, '8000000');

  assert.equal(caseData.escrow.fundedMicro, '100000000');
  assert.equal(caseData.escrow.refundedMicro, '20000000');
  assert.equal(caseData.escrow.completionPaidMicro, '72000000');
  assert.equal(caseData.escrow.holdbackHeldMicro, '0');
  assert.equal(caseData.escrow.holdbackReleasedMicro, '8000000');
  assert.equal(totalForCase(caseData), '100000000');

  const paid = caseData.payments.reduce((sum, payment) => sum + BigInt(payment.amountMicro), 0n);
  assert.equal(paid.toString(), '100000000');
  assert.deepEqual(
    caseData.payments.map((payment) => payment.kind),
    ['REFUND', 'COMPLETION', 'HOLDBACK'],
  );
});

test('pothole case contains duplicate reports and a human-confirmed cluster', () => {
  const caseData = requirePathCase();

  assert.equal(caseData.reports.length, 2);
  assert.deepEqual(
    caseData.reports.map((report) => report.id),
    ['R-008', 'R-009'],
  );
  assert.ok(caseData.reports.every((report) => report.status === 'CLUSTERED'));
  assert.equal(caseData.reports[0]?.perceptualHash, caseData.reports[1]?.perceptualHash);
  assert.equal(caseData.cluster?.id, 'CL-0002');
  assert.equal(caseData.cluster?.status, 'CONFIRMED');
  assert.equal(caseData.cluster?.confirmedBy, ACCOUNTS.steward);
  assert.deepEqual(caseData.cluster?.reportIds, ['R-008', 'R-009']);
});

test('pothole sealed bids rank B 9270 > C 5200 > A 2873 and B wins at 80 USDC', () => {
  const caseData = requirePathCase();

  assert.equal(caseData.commitments.length, 3);
  assert.equal(caseData.reveals.length, 3);
  assert.equal(caseData.contractorId, ACCOUNTS.contractorB);

  const ranking = caseData.score?.ranking.map(({ rank, contractorId, scoreBps, priceMicro }) => ({
    rank,
    contractorId,
    scoreBps,
    priceMicro,
  }));

  assert.deepEqual(ranking, [
    { rank: 1, contractorId: ACCOUNTS.contractorB, scoreBps: 9270, priceMicro: '80000000' },
    { rank: 2, contractorId: ACCOUNTS.contractorC, scoreBps: 5200, priceMicro: '78000000' },
    { rank: 3, contractorId: ACCOUNTS.contractorA, scoreBps: 2873, priceMicro: '95000000' },
  ]);
});

test('pothole case includes AI triage, steward scope and DAO authorization replay data', () => {
  const caseData = requirePathCase();

  const ai = caseData.attestations.find((attestation) => attestation.kind === 'NEAR_AI');
  assert.ok(ai);
  assert.equal(ai.verified, false);
  assert.match(ai.detail, /duplicate candidate/);

  const dao = caseData.attestations.find((attestation) => attestation.kind === 'DAO');
  assert.ok(dao);
  assert.match(dao.label, /#48/);
  assert.equal(caseData.daoApproval.state, 'APPROVED');
  assert.equal(caseData.daoApproval.budgetMicro, '100000000');
  assert.equal(caseData.daoApproval.proposalId, '48');
});

test('pothole durability passed, holdback released and case closed', () => {
  const caseData = requirePathCase();

  const durability = caseData.inspections.find((inspection) => inspection.kind === 'DURABILITY');
  assert.ok(durability);
  assert.equal(durability.decision, 'APPROVED');
  assert.equal(durability.signedAt, caseData.updatedAt);

  const closeEvent = caseData.events.at(-1);
  assert.equal(closeEvent?.id, 'E-PATH-PAY-8');
  assert.match(closeEvent?.detail ?? '', /20 refunded \+ 72 completion \+ 8 holdback = 100 funded/);
});

test('report form exposes the path area and pothole/path-surface category', () => {
  assert.ok(
    REPORT_AREAS.some(
      (area) => area.value === 'path' && area.label === 'Riverside path — north gate',
    ),
  );
  assert.ok(
    REPORT_CATEGORIES.some(
      (category) =>
        category.value === 'pothole' &&
        category.label === 'Pothole / path surface' &&
        category.protocolValue === 'other',
    ),
  );
});

test('report routing submits protocol-safe other and maps path to PATH-006', () => {
  assert.equal(protocolCategoryFor('pothole'), 'other');
  assert.equal(protocolCategoryFor('other'), 'other');
  assert.equal(protocolCategoryFor('bench'), 'bench');

  assert.equal(assetIdForReport('pothole', 'path'), 'PATH-006');
  assert.equal(assetIdForReport('other', 'path'), 'PATH-006');
  assert.equal(assetIdForReport('pothole', 'bench'), 'UNASSIGNED');
  assert.equal(assetIdForReport('other', 'bench'), 'UNASSIGNED');

  assert.equal(assetIdForReport('bench', 'bench'), 'BENCH-001');
  assert.equal(assetIdForReport('bicycle_rack', 'rack'), 'RACK-002');
  assert.equal(assetIdForReport('door', 'door'), 'DOOR-003');
  assert.equal(assetIdForReport('fence', 'fence'), 'FENCE-004');
  assert.equal(assetIdForReport('playground', 'playground'), 'PLAY-005');
});

test('existing bench case accounting and ranking are unchanged', () => {
  const bench = CASE_BY_ID['WO-BENCH-001-0001'];
  assert.ok(bench);

  assert.equal(bench.budgetMicro, '100000000');
  assert.equal(bench.escrow.refundedMicro, '20000000');
  assert.equal(bench.escrow.completionPaidMicro, '72000000');
  assert.equal(bench.escrow.holdbackReleasedMicro, '8000000');
  assert.equal(bench.escrow.holdbackHeldMicro, '0');
  assert.equal(totalForCase(bench), '100000000');
  assert.equal(bench.score?.ranking[0]?.scoreBps, 9270);
});

test('public metrics include the new asset and case', () => {
  const metrics = getPublicMetrics();
  assert.ok(metrics.assets >= 7);
  assert.ok(metrics.cases >= 7);
  assert.ok(ASSET_BY_ID['PATH-006']);
  assert.ok(CASES.some((caseData) => caseData.id === PATH_CASE_ID));
});
