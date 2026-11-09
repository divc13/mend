import {
  FIXTURE_ACCOUNTS,
  FIXTURE_ASSET_BENCH,
  FIXTURE_ASSET_RACK,
  FIXTURE_BID_COMMITMENTS,
  FIXTURE_BID_INPUTS,
  FIXTURE_BIDS,
  FIXTURE_CLUSTER,
  FIXTURE_DAO_APPROVAL,
  FIXTURE_EXPECTED_MONEY,
  FIXTURE_EXPECTED_RANKING,
  FIXTURE_EXPLANATIONS,
  FIXTURE_IDS,
  FIXTURE_POLICY,
  FIXTURE_REPORT_1,
  FIXTURE_REPORT_2,
  FIXTURE_SCENARIOS,
  FIXTURE_TIMESTAMPS,
  FIXTURE_WORK_ORDER,
} from '@mend/protocol';

export {
  FIXTURE_ACCOUNTS,
  FIXTURE_ASSET_BENCH,
  FIXTURE_ASSET_RACK,
  FIXTURE_BID_COMMITMENTS,
  FIXTURE_BID_INPUTS,
  FIXTURE_BIDS,
  FIXTURE_CLUSTER,
  FIXTURE_DAO_APPROVAL,
  FIXTURE_EXPECTED_MONEY,
  FIXTURE_EXPECTED_RANKING,
  FIXTURE_EXPLANATIONS,
  FIXTURE_IDS,
  FIXTURE_POLICY,
  FIXTURE_REPORT_1,
  FIXTURE_REPORT_2,
  FIXTURE_SCENARIOS,
  FIXTURE_TIMESTAMPS,
  FIXTURE_WORK_ORDER,
};

export type {
  Asset,
  BidCommitmentInput,
  DaoApproval,
  Report,
  ReportCluster,
  ScoreBidInput,
  WorkOrder,
} from '@mend/protocol';

export interface CanonicalFixtures {
  accounts: typeof FIXTURE_ACCOUNTS;
  ids: typeof FIXTURE_IDS;
  timestamps: typeof FIXTURE_TIMESTAMPS;
  policy: typeof FIXTURE_POLICY;
  assetBench: typeof FIXTURE_ASSET_BENCH;
  assetRack: typeof FIXTURE_ASSET_RACK;
  report1: typeof FIXTURE_REPORT_1;
  report2: typeof FIXTURE_REPORT_2;
  cluster: typeof FIXTURE_CLUSTER;
  daoApproval: typeof FIXTURE_DAO_APPROVAL;
  workOrder: typeof FIXTURE_WORK_ORDER;
  bidInputs: typeof FIXTURE_BID_INPUTS;
  bids: typeof FIXTURE_BIDS;
  bidCommitments: typeof FIXTURE_BID_COMMITMENTS;
  expectedRanking: typeof FIXTURE_EXPECTED_RANKING;
  expectedMoney: typeof FIXTURE_EXPECTED_MONEY;
  explanations: typeof FIXTURE_EXPLANATIONS;
  scenarios: typeof FIXTURE_SCENARIOS;
}

/**
 * Typed access to the canonical `@mend/protocol` fixtures. The values are the
 * protocol objects themselves, not copies: a test that asserts identity and a
 * test that asserts the shared fixture contract cannot drift apart. No
 * filesystem or network access is involved.
 */
export function loadCanonicalFixtures(): CanonicalFixtures {
  return {
    accounts: FIXTURE_ACCOUNTS,
    ids: FIXTURE_IDS,
    timestamps: FIXTURE_TIMESTAMPS,
    policy: FIXTURE_POLICY,
    assetBench: FIXTURE_ASSET_BENCH,
    assetRack: FIXTURE_ASSET_RACK,
    report1: FIXTURE_REPORT_1,
    report2: FIXTURE_REPORT_2,
    cluster: FIXTURE_CLUSTER,
    daoApproval: FIXTURE_DAO_APPROVAL,
    workOrder: FIXTURE_WORK_ORDER,
    bidInputs: FIXTURE_BID_INPUTS,
    bids: FIXTURE_BIDS,
    bidCommitments: FIXTURE_BID_COMMITMENTS,
    expectedRanking: FIXTURE_EXPECTED_RANKING,
    expectedMoney: FIXTURE_EXPECTED_MONEY,
    explanations: FIXTURE_EXPLANATIONS,
    scenarios: FIXTURE_SCENARIOS,
  };
}

export const canonicalFixtures = loadCanonicalFixtures;
