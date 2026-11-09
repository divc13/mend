import { BPS_DENOMINATOR, DEFAULT_SCORING_POLICY_BPS, SCORING_POLICY_VERSION } from './constants.js';
import { MendError } from './errors.js';

export interface ScoreWeightsBps {
  price: number;
  warranty: number;
  duration: number;
  materials: number;
}

export interface ScorePolicy {
  version: string;
  weightsBps: ScoreWeightsBps;
}

export interface ScoreBidInput {
  bidId: string;
  contractorId: string;
  /** Integer micro-units. */
  priceMicro: string | bigint;
  /** Completion duration in whole days, > 0. */
  durationDays: number;
  /** Warranty duration in whole days, >= 0. */
  warrantyDays: number;
  /** Deterministic materials-quality score supplied in the revealed bid, 0..100. */
  materialsScore: number;
  eligible: boolean;
}

export interface DimensionScoresBps {
  price: number;
  warranty: number;
  duration: number;
  materials: number;
}

export interface ScoredBid {
  rank: number;
  bidId: string;
  contractorId: string;
  scoreBps: number;
  dimensionsBps: DimensionScoresBps;
  priceMicro: string;
  durationDays: number;
  warrantyDays: number;
  materialsScore: number;
}

export interface ExcludedBid {
  bidId: string;
  reason: string;
}

export interface ScoreResult {
  policyVersion: string;
  weightsBps: ScoreWeightsBps;
  ranking: ScoredBid[];
  excluded: ExcludedBid[];
}

export const DEFAULT_SCORE_POLICY: ScorePolicy = {
  version: SCORING_POLICY_VERSION,
  weightsBps: DEFAULT_SCORING_POLICY_BPS,
};

export function validatePolicy(policy: ScorePolicy): void {
  const entries = Object.entries(policy.weightsBps);
  for (const [key, value] of entries) {
    if (!Number.isInteger(value) || value < 0 || value > BPS_DENOMINATOR) {
      throw new MendError('SCORE_INVALID', `invalid weight for ${key}: ${value}`);
    }
  }
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total !== BPS_DENOMINATOR) {
    throw new MendError('SCORE_INVALID', `score weights must total ${BPS_DENOMINATOR}, got ${total}`);
  }
  if (!policy.version || policy.version.length > 64) {
    throw new MendError('SCORE_INVALID', 'policy version is required');
  }
}

function normalize(
  value: bigint,
  min: bigint,
  max: bigint,
  direction: 'higher' | 'lower',
): bigint {
  if (max === min) return BigInt(BPS_DENOMINATOR);
  const raw = direction === 'lower' ? max - value : value - min;
  return (raw * BigInt(BPS_DENOMINATOR)) / (max - min); // floor, documented in RULES.md
}

/**
 * Deterministic integer scoring. No floating point, no LLM.
 * Ranking: score desc, then price asc, warranty desc, duration asc, bidId asc.
 */
export function scoreBids(bids: readonly ScoreBidInput[], policy: ScorePolicy = DEFAULT_SCORE_POLICY): ScoreResult {
  validatePolicy(policy);

  const excluded: ExcludedBid[] = [];
  const eligible: ScoreBidInput[] = [];

  for (const bid of bids) {
    if (!bid.eligible) {
      excluded.push({ bidId: bid.bidId, reason: 'ineligible' });
      continue;
    }
    if (!Number.isInteger(bid.durationDays) || bid.durationDays <= 0) {
      throw new MendError('SCORE_INVALID', `invalid duration for ${bid.bidId}`);
    }
    if (!Number.isInteger(bid.warrantyDays) || bid.warrantyDays < 0) {
      throw new MendError('SCORE_INVALID', `invalid warranty for ${bid.bidId}`);
    }
    if (!Number.isInteger(bid.materialsScore) || bid.materialsScore < 0 || bid.materialsScore > 100) {
      throw new MendError('SCORE_INVALID', `invalid materials score for ${bid.bidId}`);
    }
    const price = BigInt(bid.priceMicro);
    if (price <= 0n) throw new MendError('SCORE_INVALID', `invalid price for ${bid.bidId}`);
    eligible.push(bid);
  }

  if (eligible.length === 0) {
    throw new MendError('SCORE_INVALID', 'no eligible bids to score');
  }

  const prices = eligible.map((b) => BigInt(b.priceMicro));
  const durations = eligible.map((b) => BigInt(b.durationDays));
  const warranties = eligible.map((b) => BigInt(b.warrantyDays));

  const minPrice = prices.reduce((a, b) => (a < b ? a : b));
  const maxPrice = prices.reduce((a, b) => (a > b ? a : b));
  const minDuration = durations.reduce((a, b) => (a < b ? a : b));
  const maxDuration = durations.reduce((a, b) => (a > b ? a : b));
  const minWarranty = warranties.reduce((a, b) => (a < b ? a : b));
  const maxWarranty = warranties.reduce((a, b) => (a > b ? a : b));

  const weights = policy.weightsBps;

  const scored: ScoredBid[] = eligible.map((bid) => {
    const price = BigInt(bid.priceMicro);
    const duration = BigInt(bid.durationDays);
    const warranty = BigInt(bid.warrantyDays);
    const material = BigInt(bid.materialsScore);

    const dimensionsBps: DimensionScoresBps = {
      price: Number(normalize(price, minPrice, maxPrice, 'lower')),
      warranty: Number(normalize(warranty, minWarranty, maxWarranty, 'higher')),
      duration: Number(normalize(duration, minDuration, maxDuration, 'lower')),
      // materialsPoints is already an absolute 0..100 quality score; scale it, do not min-max it.
      materials: Number(material * 100n),
    };

    const weighted =
      BigInt(weights.price) * BigInt(dimensionsBps.price) +
      BigInt(weights.warranty) * BigInt(dimensionsBps.warranty) +
      BigInt(weights.duration) * BigInt(dimensionsBps.duration) +
      BigInt(weights.materials) * BigInt(dimensionsBps.materials);

    const scoreBps = Number((weighted + BigInt(BPS_DENOMINATOR) / 2n) / BigInt(BPS_DENOMINATOR));

    return {
      rank: 0,
      bidId: bid.bidId,
      contractorId: bid.contractorId,
      scoreBps,
      dimensionsBps,
      priceMicro: price.toString(),
      durationDays: bid.durationDays,
      warrantyDays: bid.warrantyDays,
      materialsScore: bid.materialsScore,
    };
  });

  scored.sort((a, b) => {
    if (b.scoreBps !== a.scoreBps) return b.scoreBps - a.scoreBps;
    const priceA = BigInt(a.priceMicro);
    const priceB = BigInt(b.priceMicro);
    if (priceA !== priceB) return priceA < priceB ? -1 : 1;
    if (a.warrantyDays !== b.warrantyDays) return b.warrantyDays - a.warrantyDays;
    if (a.durationDays !== b.durationDays) return a.durationDays - b.durationDays;
    return a.bidId.localeCompare(b.bidId);
  });

  scored.forEach((bid, index) => {
    bid.rank = index + 1;
  });

  return { policyVersion: policy.version, weightsBps: policy.weightsBps, ranking: scored, excluded };
}
