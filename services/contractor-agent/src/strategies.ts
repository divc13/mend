import {
  FIXTURE_ACCOUNTS,
  FIXTURE_BID_INPUTS,
  FIXTURE_EXPLANATIONS,
  FIXTURE_IDS,
} from '@mend/protocol';
import type { BidCommitmentInput } from '@mend/protocol';

export type StrategyKey = 'A' | 'B' | 'C';

export interface ContractorStrategy {
  key: StrategyKey;
  account: string;
  materialsDescription: string;
  explanation: string;
  bid: BidCommitmentInput;
}

/**
 * Frozen deterministic demo strategies. These values must stay byte-identical
 * to `FIXTURE_BID_INPUTS` in @mend/protocol: A 95/14/90/60, B 80/10/180/80,
 * C 78/21/30/70. Each agent uses a separate sub-account.
 */
export const CONTRACTOR_STRATEGIES: Readonly<Record<StrategyKey, ContractorStrategy>> = {
  A: {
    key: 'A',
    account: FIXTURE_ACCOUNTS.contractorA,
    materialsDescription: 'Standard replacement plank with painted steel fasteners',
    explanation: FIXTURE_EXPLANATIONS.A,
    bid: {
      bidId: FIXTURE_IDS.bidA,
      contractorId: FIXTURE_ACCOUNTS.contractorA,
      priceMicro: '95000000',
      durationDays: 14,
      warrantyDays: 90,
      materialsScore: 60,
      evidenceChecklistAccepted: true,
      nonce: 'nonce-a-0001',
    },
  },
  B: {
    key: 'B',
    account: FIXTURE_ACCOUNTS.contractorB,
    materialsDescription: 'Hardwood replacement plank with galvanized fasteners',
    explanation: FIXTURE_EXPLANATIONS.B,
    bid: {
      bidId: FIXTURE_IDS.bidB,
      contractorId: FIXTURE_ACCOUNTS.contractorB,
      priceMicro: '80000000',
      durationDays: 10,
      warrantyDays: 180,
      materialsScore: 80,
      evidenceChecklistAccepted: true,
      nonce: 'nonce-b-0002',
    },
  },
  C: {
    key: 'C',
    account: FIXTURE_ACCOUNTS.contractorC,
    materialsDescription: 'Budget composite plank with basic fasteners',
    explanation: FIXTURE_EXPLANATIONS.C,
    bid: {
      bidId: FIXTURE_IDS.bidC,
      contractorId: FIXTURE_ACCOUNTS.contractorC,
      priceMicro: '78000000',
      durationDays: 21,
      warrantyDays: 30,
      materialsScore: 70,
      evidenceChecklistAccepted: true,
      nonce: 'nonce-c-0003',
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
}

function expectBidEqual(actual: BidCommitmentInput, expected: BidCommitmentInput): void {
  for (const field of [
    'bidId',
    'contractorId',
    'priceMicro',
    'durationDays',
    'warrantyDays',
    'materialsScore',
    'evidenceChecklistAccepted',
    'nonce',
  ] as const) {
    if (actual[field] !== expected[field]) {
      throw new Error(`strategy field ${field} drifted from the canonical fixture`);
    }
  }
}
