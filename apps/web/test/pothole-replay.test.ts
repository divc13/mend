import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCOUNTS,
  CASE_BY_ID,
  CASES,
  DEMO_CASE_STATE,
  DEMO_CASE_STATES,
  buildPotholeReplayCase,
  casesForAsset,
  totalForCase,
} from '../src/lib/fixtures';

const REPLAY_CASE_ID = 'WO-PATH-001-0002';

// Mirrors the steward console's award gate: a rank-1 bid exists and the case is
// not already in an awarded-or-later state.
const AWARDED_STATES = [
  'AWARDED',
  'IN_PROGRESS',
  'COMPLETION_SUBMITTED',
  'COMPLETION_ACCEPTED',
  'DURABILITY_PENDING',
  'CLOSED',
  'WARRANTY_REOPENED',
  'DISPUTED',
];

function canConfirmAward(caseData: ReturnType<typeof buildPotholeReplayCase>): boolean {
  const winner = caseData.score?.ranking.some((bid) => bid.rank === 1);
  const alreadyAwarded = AWARDED_STATES.includes(caseData.status) && Boolean(caseData.contractorId);
  return Boolean(winner) && !alreadyAwarded;
}

function canAcceptCompletion(caseData: ReturnType<typeof buildPotholeReplayCase>): boolean {
  return caseData.status === 'COMPLETION_SUBMITTED' && caseData.evidence.length > 0;
}

test('the staged pothole replay case is the only pothole case in the app', () => {
  const replay = CASE_BY_ID[REPLAY_CASE_ID];
  assert.ok(replay, `expected ${REPLAY_CASE_ID} to exist`);
  assert.equal(replay.id, REPLAY_CASE_ID);
  assert.equal(replay.title, 'Riverside path — north gate pothole');
  assert.equal(replay.assetId, 'PATH-006');
  assert.equal(replay.mode, 'REPLAY');

  assert.ok(DEMO_CASE_STATES.includes(DEMO_CASE_STATE));
  assert.equal(replay.status, DEMO_CASE_STATE);

  assert.deepEqual(
    casesForAsset('PATH-006').map((caseData) => caseData.id),
    [REPLAY_CASE_ID],
  );
});

test('every staged state uses the same pothole bid data and deterministic ranking', () => {
  for (const state of DEMO_CASE_STATES) {
    const caseData = buildPotholeReplayCase(state);

    assert.equal(caseData.assetId, 'PATH-006');
    assert.equal(caseData.budgetMicro, '100000000');
    assert.equal(caseData.winningBidMicro, '80000000');
    assert.equal(caseData.refundMicro, '20000000');
    assert.equal(caseData.completionPaymentMicro, '72000000');
    assert.equal(caseData.holdbackMicro, '8000000');
    assert.equal(caseData.daoApproval.state, 'APPROVED');
    assert.equal(caseData.daoApproval.budgetMicro, '100000000');
    assert.equal(caseData.commitments.length, 3);
    assert.equal(caseData.reveals.length, 3);

    assert.deepEqual(
      caseData.score?.ranking.map(({ rank, contractorId, scoreBps, priceMicro }) => ({
        rank,
        contractorId,
        scoreBps,
        priceMicro,
      })),
      [
        { rank: 1, contractorId: ACCOUNTS.contractorB, scoreBps: 9270, priceMicro: '80000000' },
        { rank: 2, contractorId: ACCOUNTS.contractorC, scoreBps: 5200, priceMicro: '78000000' },
        { rank: 3, contractorId: ACCOUNTS.contractorA, scoreBps: 2873, priceMicro: '95000000' },
      ],
    );
  }
});

test('BIDDING is funded, unscored into an award, and ready for live steward award and reveal', () => {
  const caseData = buildPotholeReplayCase('BIDDING');

  assert.equal(caseData.status, 'BIDDING');
  assert.equal(caseData.contractorId, undefined);
  assert.equal(caseData.inspectorId, undefined);
  assert.deepEqual(caseData.evidence, []);
  assert.deepEqual(caseData.inspections, []);

  assert.equal(caseData.escrow.fundedMicro, '100000000');
  assert.equal(caseData.escrow.refundedMicro, '0');
  assert.equal(caseData.escrow.escrowedMicro, '100000000');
  assert.equal(caseData.escrow.completionPaidMicro, '0');
  assert.equal(caseData.escrow.holdbackHeldMicro, '0');
  assert.equal(caseData.escrow.holdbackReleasedMicro, '0');
  assert.equal(caseData.payments.length, 0);
  assert.equal(totalForCase(caseData), '100000000');

  assert.equal(caseData.winningBidMicro, '80000000');
  assert.equal(caseData.score?.ranking[0]?.contractorId, ACCOUNTS.contractorB);
  assert.ok(caseData.reveals.length > 0, 'bid room needs reveal data');
  assert.equal(canConfirmAward(caseData), true);
  assert.equal(canAcceptCompletion(caseData), false);
});

test('COMPLETION_SUBMITTED is awarded, evidenced and ready for inspector acceptance', () => {
  const caseData = buildPotholeReplayCase('COMPLETION_SUBMITTED');

  assert.equal(caseData.status, 'COMPLETION_SUBMITTED');
  assert.equal(caseData.contractorId, ACCOUNTS.contractorB);
  assert.equal(caseData.inspectorId, ACCOUNTS.inspector);
  assert.notEqual(caseData.contractorId, caseData.inspectorId);

  assert.equal(caseData.evidence.length, 1);
  const evidence = caseData.evidence[0];
  assert.ok(evidence);
  assert.equal(evidence.kind, 'COMPLETION');
  assert.equal(evidence.checklist.length, 6);
  assert.ok(evidence.checklist.every((item) => item.complete));
  assert.deepEqual(caseData.inspections, []);

  assert.equal(caseData.escrow.fundedMicro, '100000000');
  assert.equal(caseData.escrow.refundedMicro, '20000000');
  assert.equal(caseData.escrow.escrowedMicro, '80000000');
  assert.equal(caseData.escrow.completionPaidMicro, '0');
  assert.equal(caseData.escrow.holdbackHeldMicro, '0');
  assert.equal(caseData.escrow.holdbackReleasedMicro, '0');
  assert.equal(totalForCase(caseData), '100000000');

  assert.deepEqual(caseData.payments.map((payment) => payment.kind), ['REFUND']);
  assert.equal(caseData.payments.some((payment) => payment.kind === 'COMPLETION'), false);

  assert.equal(canConfirmAward(caseData), false);
  assert.equal(canAcceptCompletion(caseData), true);
});

test('CLOSED preserves exact 100/20/72/8 accounting and a passed durability inspection', () => {
  const caseData = buildPotholeReplayCase('CLOSED');

  assert.equal(caseData.status, 'CLOSED');
  assert.equal(caseData.contractorId, ACCOUNTS.contractorB);
  assert.equal(caseData.inspectorId, ACCOUNTS.inspector);
  assert.equal(caseData.evidence.length, 1);

  assert.equal(caseData.escrow.fundedMicro, '100000000');
  assert.equal(caseData.escrow.refundedMicro, '20000000');
  assert.equal(caseData.escrow.completionPaidMicro, '72000000');
  assert.equal(caseData.escrow.holdbackHeldMicro, '0');
  assert.equal(caseData.escrow.holdbackReleasedMicro, '8000000');
  assert.equal(BigInt(caseData.escrow.escrowedMicro ?? '0'), 0n);
  assert.equal(totalForCase(caseData), '100000000');

  assert.deepEqual(caseData.payments.map((payment) => payment.kind), [
    'REFUND',
    'COMPLETION',
    'HOLDBACK',
  ]);
  const paid = caseData.payments.reduce((sum, payment) => sum + BigInt(payment.amountMicro), 0n);
  assert.equal(paid.toString(), '100000000');

  const durability = caseData.inspections.find((inspection) => inspection.kind === 'DURABILITY');
  assert.ok(durability);
  assert.equal(durability.decision, 'APPROVED');

  assert.equal(canConfirmAward(caseData), false);
  assert.equal(canAcceptCompletion(caseData), false);
});
