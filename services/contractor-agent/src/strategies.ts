import {
  FIXTURE_ACCOUNTS,
  FIXTURE_BID_INPUTS,
  FIXTURE_EXPLANATIONS,
  FIXTURE_EXTRA_BID_INPUTS,
  FIXTURE_EXTRA_EXPLANATIONS,
  FIXTURE_IDS,
} from '@mend/protocol';
import type { BidCommitmentInput } from '@mend/protocol';

export type StrategyKey = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ContractorStrategy {
  key: StrategyKey;
  account: string;
  /** A/B/C form the canonical three-bid scoring scenario. D/E are extra demo strategies. */
  canonical: boolean;
  materialsDescription: string;
  explanation: string;
  bid: BidCommitmentInput;
}

/**
 * Frozen deterministic demo strategies. These values must stay byte-identical
 * to `FIXTURE_BID_INPUTS` / `FIXTURE_EXTRA_BID_INPUTS` in @mend/protocol:
 * A 95/14/90/60/3, B 80/10/180/80/2, C 78/21/30/70/5,
 * D 85/12/120/75/1, E 90/7/60/90/7.
 * Each agent uses a separate sub-account.
 */
export const CONTRACTOR_STRATEGIES: Readonly<Record<StrategyKey, ContractorStrategy>> = {
  A: {
    key: 'A',
    account: FIXTURE_ACCOUNTS.contractorA,
    canonical: true,
    materialsDescription: 'Standard replacement plank with painted steel fasteners',
    explanation: FIXTURE_EXPLANATIONS.A,
    bid: {
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
  },
  B: {
    key: 'B',
    account: FIXTURE_ACCOUNTS.contractorB,
    canonical: true,
    materialsDescription: 'Hardwood replacement plank with galvanized fasteners',
    explanation: FIXTURE_EXPLANATIONS.B,
    bid: {
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
  },
  C: {
    key: 'C',
    account: FIXTURE_ACCOUNTS.contractorC,
    canonical: true,
    materialsDescription: 'Budget composite plank with basic fasteners',
    explanation: FIXTURE_EXPLANATIONS.C,
    bid: {
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
  },
  D: {
    key: 'D',
    account: FIXTURE_ACCOUNTS.contractorD,
    canonical: false,
    materialsDescription: 'Refurbished hardwood plank with stainless brackets',
    explanation: FIXTURE_EXTRA_EXPLANATIONS.D,
    bid: {
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
  },
  E: {
    key: 'E',
    account: FIXTURE_ACCOUNTS.contractorE,
    canonical: false,
    materialsDescription: 'Premium sealed hardwood plank with marine-grade fasteners',
    explanation: FIXTURE_EXTRA_EXPLANATIONS.E,
    bid: {
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
  },
} as const;

export function getStrategy(key: StrategyKey): ContractorStrategy {
  return CONTRACTOR_STRATEGIES[key];
}

/** Guards the copied literals against drift from the canonical protocol fixtures. */
export function assertStrategiesMatchProtocol(): void {
  for (const key of ['A', 'B', 'C'] as const) {
    const strategy = CONTRACTOR_STRATEGIES[key];
    expectBidEqual(strategy.bid, FIXTURE_BID_INPUTS[key]);
    if (strategy.explanation !== FIXTURE_EXPLANATIONS[key]) {
      throw new Error(`strategy ${key} explanation drifted from the frozen fixture`);
    }
  }
  for (const key of ['D', 'E'] as const) {
    const strategy = CONTRACTOR_STRATEGIES[key];
    expectBidEqual(strategy.bid, FIXTURE_EXTRA_BID_INPUTS[key]);
    if (strategy.explanation !== FIXTURE_EXTRA_EXPLANATIONS[key]) {
      throw new Error(`strategy ${key} explanation drifted from the frozen fixture`);
    }
  }
}

function expectBidEqual(actual: BidCommitmentInput, expected: BidCommitmentInput): void {
  for (const field of [
    'bidId',
    'contractorId',
    'priceMicro',
    'durationDays',
    'warrantyDays',
    'materialsScore',
    'availableInDays',
    'evidenceChecklistAccepted',
    'nonce',
  ] as const) {
    if (actual[field] !== expected[field]) {
      throw new Error(`strategy field ${field} drifted from the canonical fixture`);
    }
  }
}
