import { z } from 'zod';
import { MendError } from '@mend/protocol';
import type { ReportRecord } from '@mend/db';
import type { AppConfig } from '../config.js';

export interface DuplicateCandidate {
  reportId: string;
  scoreBps: number;
  reasons: string[];
}

export interface TriageInput {
  report: ReportRecord;
  existingReports: ReportRecord[];
  hasPreciseLocation: boolean;
}

export interface TriageResult {
  available: boolean;
  provider: string;
  model?: string;
  confidenceBps?: number;
  rationale?: string;
  duplicateCandidates: DuplicateCandidate[];
  scope?: string;
  unavailableReason?: string;
  /** True only when a verifiable inference signature was fetched and checked. */
  verified: boolean;
  attestation?: {
    kind: 'NEAR_AI' | 'HUMAN' | 'LOCAL_REPLAY';
    artifact: Record<string, unknown>;
    signature?: string;
  };
}

export interface TriageAdapter {
  readonly provider: string;
  readonly model?: string;
  readonly available: boolean;
  readonly unavailableReason?: string;
  inspect(input: TriageInput): Promise<TriageResult>;
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function words(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
}

function jaccard(a: string, b: string): number {
  const left = words(a);
  const right = words(b);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const word of left) if (right.has(word)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

/**
 * Deterministic duplicate heuristic. This is explicitly NOT presented as AI
 * reasoning; it is used to give the steward useful candidates when private
 * inference is unavailable.
 */
export function localDuplicateCandidates(report: ReportRecord, existing: ReportRecord[]): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];
  for (const other of existing) {
    if (other.id === report.id) continue;
    const reasons: string[] = [];
    let score = 0;
    if (other.assetId !== report.assetId) continue;
    if (other.perceptualHash && other.perceptualHash === report.perceptualHash) {
      score = Math.max(score, 9_500);
      reasons.push('identical perceptual hash');
    }
    const distance = haversineMeters(
      { lat: report.publicLocation.coarseLat, lng: report.publicLocation.coarseLng },
      { lat: other.publicLocation.coarseLat, lng: other.publicLocation.coarseLng },
    );
    if (distance <= 50) {
      score = Math.max(score, 7_000);
      reasons.push(`coarse locations ${Math.round(distance)} m apart`);
    }
    const similarity = jaccard(report.description, other.description);
    if (similarity >= 0.3) {
      score = Math.max(score, Math.round(4_000 + similarity * 4_000));
      reasons.push(`text similarity ${(similarity * 100).toFixed(0)}%`);
    }
    if (reasons.length > 0) candidates.push({ reportId: other.id, scoreBps: score, reasons });
  }
  return candidates.sort((a, b) => b.scoreBps - a.scoreBps || a.reportId.localeCompare(b.reportId)).slice(0, 5);
}

const modelOutputSchema = z.object({
  confidenceBps: z.number().int().min(0).max(10_000),
  rationale: z.string().min(1).max(2000),
  scope: z.string().min(1).max(4000).optional(),
  duplicateCandidates: z
    .array(
      z.object({
        reportId: z.string(),
        scoreBps: z.number().int().min(0).max(10_000),
        reasons: z.array(z.string()).max(10).default([]),
      }),
    )
    .max(10)
    .default([]),
});

/**
 * NEAR AI Cloud private-inference adapter. Without a key it reports an
 * unavailable state; it never fabricates a confidence score or rationale.
 * Response signatures are not returned inline by NEAR AI, so a result is only
 * marked verified when the separate signature endpoint has been fetched and
 * checked. That step is intentionally not claimed in this wave.
 */
export class NearAiTriageAdapter implements TriageAdapter {
  readonly provider = 'NEAR AI Cloud';
  readonly model: string;
  readonly available: boolean;
  readonly unavailableReason?: string;

  constructor(private readonly config: AppConfig['triage']) {
    this.model = config.model;
    this.available = Boolean(config.apiKey);
    if (!this.available) this.unavailableReason = 'NEAR_AI_API_KEY is not configured';
  }

  async inspect(input: TriageInput): Promise<TriageResult> {
    const candidates = localDuplicateCandidates(input.report, input.existingReports);
    if (!this.available) {
      return {
        available: false,
        provider: this.provider,
        model: this.model,
        duplicateCandidates: candidates,
        rationale: 'Private AI inference is unavailable, so only deterministic duplicate heuristics are shown. No AI classification is claimed.',
        unavailableReason: 'NEAR_AI_API_KEY is not configured',
        verified: false,
      };
    }
    const prompt = [
      'You are a private repair-triage assistant. Return ONLY JSON with keys:',
      'confidenceBps (0-10000), rationale (short, no hidden chain-of-thought),',
      'scope (standardized repair scope), duplicateCandidates (array of {reportId, scoreBps, reasons}).',
      'Never invent report IDs. Candidate reports are supplied below.',
      JSON.stringify({
        report: {
          id: input.report.id,
          assetId: input.report.assetId,
          description: input.report.description,
          publicLocation: input.report.publicLocation,
          perceptualHash: input.report.perceptualHash,
        },
        candidates,
      }),
    ].join('\n');

    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: 'Return strict JSON only.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0,
          max_tokens: 800,
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
      if (!response.ok) {
        return {
          available: false,
          provider: this.provider,
          model: this.model,
          duplicateCandidates: candidates,
          unavailableReason: `NEAR AI Cloud returned HTTP ${response.status}`,
          verified: false,
        };
      }
      const body = (await response.json()) as {
        id?: string;
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new Error('missing completion content');
      const parsed = modelOutputSchema.parse(JSON.parse(content));
      const knownIds = new Set(input.existingReports.map((r) => r.id));
      return {
        available: true,
        provider: this.provider,
        model: this.model,
        confidenceBps: parsed.confidenceBps,
        rationale: parsed.rationale,
        scope: parsed.scope,
        duplicateCandidates: parsed.duplicateCandidates.filter((candidate) => knownIds.has(candidate.reportId)),
        unavailableReason: 'NEAR AI response signature not fetched; inference is unverified (no attestation claim).',
        verified: false,
        attestation: {
          kind: 'NEAR_AI',
          artifact: {
            provider: this.provider,
            model: this.model,
            requestId: body.id,
            output: parsed,
            signatureFetched: false,
          },
        },
      };
    } catch (error) {
      return {
        available: false,
        provider: this.provider,
        model: this.model,
        duplicateCandidates: candidates,
        unavailableReason: `NEAR AI request failed: ${(error as Error).message}`,
        verified: false,
      };
    }
  }
}

export class UnavailableTriageAdapter implements TriageAdapter {
  readonly provider = 'NEAR AI Cloud';
  readonly available = false;
  readonly unavailableReason: string;

  constructor(private readonly reason: string) {
    this.unavailableReason = reason;
  }

  async inspect(input: TriageInput): Promise<TriageResult> {
    return {
      available: false,
      provider: this.provider,
      duplicateCandidates: localDuplicateCandidates(input.report, input.existingReports),
      rationale: 'Private AI inference is unavailable, so only deterministic duplicate heuristics are shown. No AI classification is claimed.',
      unavailableReason: this.reason,
      verified: false,
    };
  }
}

export function createTriageAdapter(config: AppConfig['triage']): TriageAdapter {
  return new NearAiTriageAdapter(config);
}

export function assertTriageResult(result: TriageResult): void {
  if (result.available && result.confidenceBps === undefined) {
    throw new MendError('UPSTREAM_UNAVAILABLE', 'Triage adapter claimed availability without a confidence score');
  }
}
