import { CANONICAL_AMOUNTS, DEFAULT_SCORING_POLICY_BPS, SCORING_POLICY_VERSION, TESTNET_HUB_ACCOUNT, TESTNET_TOKEN_ACCOUNT } from './constants.js';
import { bidCommitmentHash, policyHash } from './hashing.js';
import type { BidCommitmentInput } from './hashing.js';
import type { ScoreBidInput } from './scoring.js';
import type { Asset, DaoApproval, Report, ReportCluster, WorkOrder } from './schemas.js';

/** Canonical fixture values shared by every track (T00.3). All accounts are testnet/fictional. */
export const FIXTURE_ACCOUNTS = {
  hub: TESTNET_HUB_ACCOUNT,
  token: TESTNET_TOKEN_ACCOUNT,
  dao: 'mend-dao.sputnikv2.testnet',
  steward: 'steward.mend.testnet',
  sponsor: 'sponsor.mend.testnet',
  coordinatorAi: 'coordinator-ai.mend.testnet',
  reviewerAi: 'reviewer-ai.mend.testnet',
  relayer: 'relayer.mend.testnet',
  contractorA: 'contractor-a.mend.testnet',
  contractorB: 'contractor-b.mend.testnet',
  contractorC: 'contractor-c.mend.testnet',
  contractorD: 'contractor-d.mend.testnet',
  contractorE: 'contractor-e.mend.testnet',
  inspector: 'inspector.mend.testnet',
  inspector2: 'inspector-2.mend.testnet',
} as const;

export const FIXTURE_INSPECTORS = [FIXTURE_ACCOUNTS.inspector, FIXTURE_ACCOUNTS.inspector2] as const;

export const FIXTURE_IDS = {
  assetBench: 'BENCH-001',
  assetRack: 'RACK-002',
  report1: 'R-001',
  report2: 'R-002',
  cluster: 'CL-0001',
  workOrder: 'WO-BENCH-001-0001',
  workOrderRack: 'WO-RACK-002-0001',
  daoProposal: '42',
  bidA: 'BID-A-BENCH-001',
  bidB: 'BID-B-BENCH-001',
  bidC: 'BID-C-BENCH-001',
  bidD: 'BID-D-BENCH-001',
  bidE: 'BID-E-BENCH-001',
  scoreExecution: 'SX-0001',
  evidenceCompletion: 'EV-0001',
  evidenceRemediation: 'EV-0002',
  inspectionCompletion: 'INS-0001',
  inspectionDurability: 'INS-0002',
  warrantyCase: 'WC-0001',
  intentQuote: 'IQ-0001',
} as const;

export const FIXTURE_TIMESTAMPS = {
  assetCreated: '2026-11-10T08:00:00.000Z',
  report1: '2026-11-10T08:10:00.000Z',
  report2: '2026-11-10T08:12:00.000Z',
  clusterConfirmed: '2026-11-10T08:20:00.000Z',
  policyApproved: '2026-11-10T08:30:00.000Z',
  funded: '2026-11-10T08:40:00.000Z',
  biddingOpen: '2026-11-10T09:00:00.000Z',
  revealStart: '2026-11-10T09:10:00.000Z',
  revealEnd: '2026-11-10T09:20:00.000Z',
  scored: '2026-11-10T09:21:00.000Z',
  awarded: '2026-11-10T09:25:00.000Z',
  completionSubmitted: '2026-11-10T11:00:00.000Z',
  completionAccepted: '2026-11-10T11:30:00.000Z',
  durabilityDue: '2026-11-10T13:30:00.000Z',
  durabilityPassed: '2026-11-10T13:35:00.000Z',
  warrantyFailed: '2026-11-10T13:35:00.000Z',
} as const;

export const FIXTURE_POLICY = {
  version: SCORING_POLICY_VERSION,
  weightsBps: DEFAULT_SCORING_POLICY_BPS,
} as const;

export const FIXTURE_ASSET_BENCH: Asset = {
  id: FIXTURE_IDS.assetBench,
  publicDescription: 'Public park bench with a split seat plank and loose armrest.',
  assetType: 'bench',
  publicLocation: { label: 'Riverside Park, bench near east gate', coarseLat: 52.52, coarseLng: 13.405, area: 'Riverside Park' },
  createdAt: FIXTURE_TIMESTAMPS.assetCreated,
};

export const FIXTURE_ASSET_RACK: Asset = {
  id: FIXTURE_IDS.assetRack,
  publicDescription: 'Community-centre bicycle rack with a bent support arm.',
  assetType: 'bicycle_rack',
  publicLocation: { label: 'Community Centre, north entrance', coarseLat: 52.521, coarseLng: 13.406, area: 'Community Centre' },
  createdAt: FIXTURE_TIMESTAMPS.assetCreated,
};

export const FIXTURE_REPORT_1: Report = {
  id: FIXTURE_IDS.report1,
  assetId: FIXTURE_IDS.assetBench,
  description: 'The seat plank is cracked and one armrest is loose. Sharp edge exposed.',
  publicLocation: FIXTURE_ASSET_BENCH.publicLocation,
  reporterCaseLink: 'case_7J2mQ9xLk4Pz1VbN',
  redactedMediaHash: 'a'.repeat(64),
  perceptualHash: 'f0e1d2c3b4a5968778695a4b3c2d1e0f',
  exifStripped: true,
  status: 'CLUSTERED',
  clusterId: FIXTURE_IDS.cluster,
  createdAt: FIXTURE_TIMESTAMPS.report1,
};

export const FIXTURE_REPORT_2: Report = {
  id: FIXTURE_IDS.report2,
  assetId: FIXTURE_IDS.assetBench,
  description: 'Bench by the east gate has a broken slat and the left arm is wobbling.',
  publicLocation: FIXTURE_ASSET_BENCH.publicLocation,
  reporterCaseLink: 'case_3Hs8Kd2Lm9Qw4XcR',
  redactedMediaHash: 'b'.repeat(64),
  perceptualHash: 'f0e1d2c3b4a5968778695a4b3c2d1e0f',
  exifStripped: true,
  status: 'CLUSTERED',
  clusterId: FIXTURE_IDS.cluster,
  createdAt: FIXTURE_TIMESTAMPS.report2,
};

export const FIXTURE_CLUSTER: ReportCluster = {
  id: FIXTURE_IDS.cluster,
  reportIds: [FIXTURE_IDS.report1, FIXTURE_IDS.report2],
  confidenceBps: 9_400,
  rationale: 'Same asset, identical perceptual hash, 12 m apart, near-identical damage description.',
  status: 'CONFIRMED',
  confirmedBy: FIXTURE_ACCOUNTS.steward,
  createdAt: FIXTURE_TIMESTAMPS.clusterConfirmed,
};

export const FIXTURE_DAO_APPROVAL: DaoApproval = {
  id: `dao-${FIXTURE_IDS.daoProposal}`,
  daoAccount: FIXTURE_ACCOUNTS.dao,
  proposalId: FIXTURE_IDS.daoProposal,
  budgetMicro: CANONICAL_AMOUNTS.sponsorBudget.toString(),
  contractorRoster: [FIXTURE_ACCOUNTS.contractorA, FIXTURE_ACCOUNTS.contractorB, FIXTURE_ACCOUNTS.contractorC],
  inspectorRoster: [FIXTURE_ACCOUNTS.inspector, FIXTURE_ACCOUNTS.inspector2],
  policyHash: policyHash(FIXTURE_POLICY),
  state: 'APPROVED',
  approvedAt: FIXTURE_TIMESTAMPS.policyApproved,
};

export const FIXTURE_WORK_ORDER: WorkOrder = {
  id: FIXTURE_IDS.workOrder,
  assetId: FIXTURE_IDS.assetBench,
  reportClusterId: FIXTURE_IDS.cluster,
  scopeHash: 'c'.repeat(64),
  daoApprovalId: FIXTURE_DAO_APPROVAL.id,
  policyHash: FIXTURE_DAO_APPROVAL.policyHash,
  budgetMicro: CANONICAL_AMOUNTS.sponsorBudget.toString(),
  status: 'AWARDED',
  mode: 'REPLAY',
  awardedBidId: FIXTURE_IDS.bidB,
  contractorId: FIXTURE_ACCOUNTS.contractorB,
  inspectorId: FIXTURE_ACCOUNTS.inspector,
  fundingToken: TESTNET_TOKEN_ACCOUNT,
  durabilityDueAt: FIXTURE_TIMESTAMPS.durabilityDue,
  reopenCount: 0,
  createdAt: FIXTURE_TIMESTAMPS.assetCreated,
  updatedAt: FIXTURE_TIMESTAMPS.awarded,
};

export const FIXTURE_BID_INPUTS: Record<'A' | 'B' | 'C', BidCommitmentInput> = {
  A: {
    bidId: FIXTURE_IDS.bidA,
    contractorId: FIXTURE_ACCOUNTS.contractorA,
    priceMicro: '95000000',
    durationDays: 14,
    warrantyDays: 90,
    materialsScore: 60,
    availableInDays: 3,
    evidenceChecklistAccepted: true,
    nonce: 'nonce-a-0001',
  },
  B: {
    bidId: FIXTURE_IDS.bidB,
    contractorId: FIXTURE_ACCOUNTS.contractorB,
    priceMicro: '80000000',
    durationDays: 10,
    warrantyDays: 180,
    materialsScore: 80,
    availableInDays: 2,
    evidenceChecklistAccepted: true,
    nonce: 'nonce-b-0002',
  },
  C: {
    bidId: FIXTURE_IDS.bidC,
    contractorId: FIXTURE_ACCOUNTS.contractorC,
    priceMicro: '78000000',
    durationDays: 21,
    warrantyDays: 30,
    materialsScore: 70,
    availableInDays: 5,
    evidenceChecklistAccepted: true,
    nonce: 'nonce-c-0003',
  },
};

/** Extra demo strategies for F13 (five contractor strategies). Not part of the canonical 3-bid scenario. */
export const FIXTURE_EXTRA_BID_INPUTS: Record<'D' | 'E', BidCommitmentInput> = {
  D: {
    bidId: FIXTURE_IDS.bidD,
    contractorId: FIXTURE_ACCOUNTS.contractorD,
    priceMicro: '85000000',
    durationDays: 12,
    warrantyDays: 120,
    materialsScore: 75,
    availableInDays: 1,
    evidenceChecklistAccepted: true,
    nonce: 'nonce-d-0004',
  },
  E: {
    bidId: FIXTURE_IDS.bidE,
    contractorId: FIXTURE_ACCOUNTS.contractorE,
    priceMicro: '90000000',
    durationDays: 7,
    warrantyDays: 60,
    materialsScore: 90,
    availableInDays: 7,
    evidenceChecklistAccepted: true,
    nonce: 'nonce-e-0005',
  },
};

export const FIXTURE_EXTRA_EXPLANATIONS: Record<'D' | 'E', string> = {
  D: 'Starts almost immediately with a balanced price and warranty.',
  E: 'Premium materials and the fastest completion, at a higher price and shorter warranty.',
};

export const FIXTURE_BIDS: ScoreBidInput[] = (['A', 'B', 'C'] as const).map((key) => {
  const bid = FIXTURE_BID_INPUTS[key];
  return {
    bidId: bid.bidId,
    contractorId: bid.contractorId,
    priceMicro: bid.priceMicro,
    durationDays: bid.durationDays,
    warrantyDays: bid.warrantyDays,
    materialsScore: bid.materialsScore,
    eligible: true,
  };
});

export const FIXTURE_BID_COMMITMENTS = (['A', 'B', 'C'] as const).map((key) => ({
  bidId: FIXTURE_BID_INPUTS[key].bidId,
  contractorId: FIXTURE_BID_INPUTS[key].contractorId,
  commitmentHash: bidCommitmentHash(FIXTURE_BID_INPUTS[key]),
}));

export const FIXTURE_EXPECTED_RANKING = [
  { rank: 1, bidId: FIXTURE_IDS.bidB, contractorId: FIXTURE_ACCOUNTS.contractorB, scoreBps: 9_270 },
  { rank: 2, bidId: FIXTURE_IDS.bidC, contractorId: FIXTURE_ACCOUNTS.contractorC, scoreBps: 5_200 },
  { rank: 3, bidId: FIXTURE_IDS.bidA, contractorId: FIXTURE_ACCOUNTS.contractorA, scoreBps: 2_873 },
] as const;

export const FIXTURE_SCENARIOS = {
  successfulRepair: 'A',
  failedDurability: 'B',
  promptInjection: 'C',
  sponsorshipUncertainty: 'D',
  judgeReplay: 'E',
} as const;

export const FIXTURE_EXPECTED_MONEY = {
  sponsorBudgetMicro: CANONICAL_AMOUNTS.sponsorBudget.toString(),
  winningBidMicro: CANONICAL_AMOUNTS.winningBid.toString(),
  refundMicro: CANONICAL_AMOUNTS.refund.toString(),
  completionPaymentMicro: CANONICAL_AMOUNTS.completionPayment.toString(),
  durabilityHoldbackMicro: CANONICAL_AMOUNTS.durabilityHoldback.toString(),
} as const;

/** Deterministic demo scoring explanation, constrained to structured bid values only. */
export const FIXTURE_EXPLANATIONS: Record<'A' | 'B' | 'C', string> = {
  A: 'Competitive price, but the shortest warranty and slowest completion reduce total value.',
  B: 'Best overall value: lowest price among strong warranties, fastest completion and strong materials.',
  C: 'Lowest sticker price, but the weakest warranty and slowest completion reduce total value.',
};
