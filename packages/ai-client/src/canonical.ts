import { createHash } from 'node:crypto';

export function sha256Hex(input: string | Uint8Array): string {
  return createHash('sha256')
    .update(typeof input === 'string' ? Buffer.from(input, 'utf8') : input)
    .digest('hex');
}

/** Stable JSON for hashing: object keys sorted recursively. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

export interface RankingEntryShape {
  rank: number;
  bidId: string;
  contractorId: string;
  scoreBps: number;
  dimensionsBps: {
    price: number;
    warranty: number;
    duration: number;
    materials: number;
  };
  priceMicro: string;
  durationDays: number;
  warrantyDays: number;
  materialsScore: number;
}

/**
 * Canonical ranking JSON compatible with the Rust artifact.
 * Field order matters: it is hashed as `MEND_SCORE_OUTPUT_V1|<json>`.
 */
export function canonicalRankingJson(ranking: readonly RankingEntryShape[]): string {
  return JSON.stringify(
    ranking.map((bid) => ({
      rank: bid.rank,
      bidId: bid.bidId,
      contractorId: bid.contractorId,
      scoreBps: bid.scoreBps,
      dimensionsBps: {
        price: bid.dimensionsBps.price,
        warranty: bid.dimensionsBps.warranty,
        duration: bid.dimensionsBps.duration,
        materials: bid.dimensionsBps.materials,
      },
      priceMicro: bid.priceMicro,
      durationDays: bid.durationDays,
      warrantyDays: bid.warrantyDays,
      materialsScore: bid.materialsScore,
    })),
  );
}

export function scoreOutputHash(ranking: readonly RankingEntryShape[]): string {
  return sha256Hex(`MEND_SCORE_OUTPUT_V1|${canonicalRankingJson(ranking)}`);
}

/** Hash a sealed scope. Untrusted prose is included only after human sealing. */
export function scopeHash(scope: unknown): string {
  return sha256Hex(stableStringify(scope));
}
