import { createHash } from 'node:crypto';
import type { ScorePolicy } from './scoring.js';

export function sha256Hex(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`;
}

export interface BidCommitmentInput {
  bidId: string;
  contractorId: string;
  priceMicro: string;
  durationDays: number;
  warrantyDays: number;
  materialsScore: number;
  /** Whole days until the contractor can start after award. Committed with the bid. */
  availableInDays: number;
  evidenceChecklistAccepted: boolean;
  nonce: string;
}

/** Canonical, contract-reproducible commitment string. Mirrored in Rust. */
export function bidCommitmentPayload(input: BidCommitmentInput): string {
  return [
    'MEND_BID_V2',
    input.bidId,
    input.contractorId,
    input.priceMicro,
    String(input.durationDays),
    String(input.warrantyDays),
    String(input.materialsScore),
    String(input.availableInDays),
    input.evidenceChecklistAccepted ? '1' : '0',
    input.nonce,
  ].join('|');
}

export function bidCommitmentHash(input: BidCommitmentInput): string {
  return sha256Hex(bidCommitmentPayload(input));
}

export function policyHash(policy: ScorePolicy): string {
  const w = policy.weightsBps;
  return sha256Hex(
    ['MEND_POLICY_V1', policy.version, String(w.price), String(w.warranty), String(w.duration), String(w.materials)].join('|'),
  );
}

/** Binds the exact policy + revealed bid commitments to one deterministic score input. */
export function scoreInputHash(policyDigest: string, bidCommitmentHashes: readonly string[]): string {
  const sorted = [...bidCommitmentHashes].sort();
  return sha256Hex(['MEND_SCORE_INPUT_V1', policyDigest, ...sorted].join('|'));
}

export function scoreOutputHash(rankingJson: string): string {
  return sha256Hex(`MEND_SCORE_OUTPUT_V1|${rankingJson}`);
}
