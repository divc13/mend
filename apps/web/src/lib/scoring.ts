import type { DimensionScores, ScoredBidView } from './types';

/**
 * Deterministic integer scoring, mirrored from `packages/protocol/src/scoring.ts`.
 * No floating point, no LLM. Used only to render the replay comparison; the
 * authoritative result is the hash-pinned OutLayer/WASM execution.
 */

export interface ScoreBidInput {
  bidId: string;
  contractorId: string;
  priceMicro: string;
  durationDays: number;
  warrantyDays: number;
  /** Carried through for display only; the frozen policy does not weight availability. */
  availableInDays: number;
  materialsScore: number;
  eligible: boolean;
}

const BPS_DENOMINATOR = 10_000;

export const DEFAULT_WEIGHTS: DimensionScores = {
  price: 4_500,
  warranty: 2_500,
  duration: 2_000,
  materials: 1_000,
};

function normalize(value: bigint, min: bigint, max: bigint, direction: 'higher' | 'lower'): bigint {
  if (max === min) return BigInt(BPS_DENOMINATOR);
  const raw = direction === 'lower' ? max - value : value - min;
  return (raw * BigInt(BPS_DENOMINATOR)) / (max - min);
}

export function scoreBids(
  bids: readonly ScoreBidInput[],
  weights: DimensionScores = DEFAULT_WEIGHTS,
): ScoredBidView[] {
  const eligible = bids.filter((bid) => bid.eligible);
  if (eligible.length === 0) return [];

  const prices = eligible.map((bid) => BigInt(bid.priceMicro));
  const durations = eligible.map((bid) => BigInt(bid.durationDays));
  const warranties = eligible.map((bid) => BigInt(bid.warrantyDays));

  const minPrice = prices.reduce((a, b) => (a < b ? a : b));
  const maxPrice = prices.reduce((a, b) => (a > b ? a : b));
  const minDuration = durations.reduce((a, b) => (a < b ? a : b));
  const maxDuration = durations.reduce((a, b) => (a > b ? a : b));
  const minWarranty = warranties.reduce((a, b) => (a < b ? a : b));
  const maxWarranty = warranties.reduce((a, b) => (a > b ? a : b));

  const scored: ScoredBidView[] = eligible.map((bid) => {
    const price = BigInt(bid.priceMicro);
    const duration = BigInt(bid.durationDays);
    const warranty = BigInt(bid.warrantyDays);
    const material = BigInt(bid.materialsScore);

    const dimensions: DimensionScores = {
      price: Number(normalize(price, minPrice, maxPrice, 'lower')),
      warranty: Number(normalize(warranty, minWarranty, maxWarranty, 'higher')),
      duration: Number(normalize(duration, minDuration, maxDuration, 'lower')),
      materials: Number(material * 100n),
    };

    const weighted =
      BigInt(weights.price) * BigInt(dimensions.price) +
      BigInt(weights.warranty) * BigInt(dimensions.warranty) +
      BigInt(weights.duration) * BigInt(dimensions.duration) +
      BigInt(weights.materials) * BigInt(dimensions.materials);

    const scoreBps = Number((weighted + BigInt(BPS_DENOMINATOR) / 2n) / BigInt(BPS_DENOMINATOR));

    return {
      rank: 0,
      bidId: bid.bidId,
      contractorId: bid.contractorId,
      scoreBps,
      dimensions,
      priceMicro: price.toString(),
      durationDays: bid.durationDays,
      warrantyDays: bid.warrantyDays,
      availableInDays: bid.availableInDays,
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

  return scored.map((bid, index) => ({ ...bid, rank: index + 1 }));
}
