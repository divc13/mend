import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  combineDuplicateSignals,
  haversineMeters,
  phashSimilarityBps,
  textSimilarityBps,
  suggestDuplicateCandidates,
  type DuplicateReport,
} from '../src/index.js';
import { RecordedChatClient } from '../src/recorded.js';

const REASONING_FIXTURE = fileURLToPath(
  new URL('../../../fixtures/recorded-responses/near-ai/duplicate-reasoning.json', import.meta.url),
);

const SUBJECT: DuplicateReport = {
  reportId: 'R-001',
  description: 'The seat plank is cracked and one armrest is loose. Sharp edge exposed.',
  perceptualHash: 'f0e1d2c3b4a5968778695a4b3c2d1e0f',
  lat: 52.52,
  lng: 13.405,
};

const CANDIDATES: DuplicateReport[] = [
  {
    reportId: 'R-002',
    description: 'Bench by the east gate has a broken slat and the left arm is wobbling.',
    perceptualHash: 'f0e1d2c3b4a5968778695a4b3c2d1e0f',
    lat: 52.5201,
    lng: 13.4051,
  },
  {
    reportId: 'R-003',
    description: 'Fresh graffiti appears on a wall near the north car park.',
    perceptualHash: '0123456789abcdef0123456789abcdef',
    lat: 52.5202,
    lng: 13.4052,
  },
];

describe('duplicate engine: deterministic signals', () => {
  it('computes distance, pHash and text similarity deterministically', () => {
    expect(haversineMeters({ lat: 52.52, lng: 13.405 }, { lat: 52.52, lng: 13.405 })).toBe(0);
    expect(phashSimilarityBps('ffffffffffffffff', 'ffffffffffffffff')).toBe(10_000);
    expect(phashSimilarityBps('0000000000000000', 'ffffffffffffffff')).toBe(0);
    expect(textSimilarityBps('a broken bench slat', 'a broken bench slat')).toBe(10_000);
    expect(textSimilarityBps('a broken bench slat', 'graffiti on a wall')).toBeLessThan(3_000);
  });

  it('combines signals with integer bps and requires human confirmation', async () => {
    const reasoning = RecordedChatClient.fromFile(REASONING_FIXTURE);
    const suggestions = await suggestDuplicateCandidates(SUBJECT, CANDIDATES, {
      reasoningClient: reasoning,
    });

    expect(suggestions).toHaveLength(2);
    const duplicate = suggestions.find((item) => item.candidateReportId === 'R-002')!;
    const unrelated = suggestions.find((item) => item.candidateReportId === 'R-003')!;

    expect(duplicate.suggested).toBe(true);
    expect(duplicate.confidenceBps).toBeGreaterThanOrEqual(7_000);
    expect(duplicate.factors.phashBps).toBe(10_000);
    expect(duplicate.requiresHumanConfirmation).toBe(true);
    expect(duplicate.privateReasoning).toContain('steward');
    expect(duplicate.reasoningSource).toBe('model');
    expect('merged' in duplicate).toBe(false);

    expect(unrelated.suggested).toBe(false);
    expect(unrelated.confidenceBps).toBeLessThan(7_000);
    expect(unrelated.requiresHumanConfirmation).toBe(true);

    // Sorted by confidence, never merged automatically.
    expect(suggestions[0]!.candidateReportId).toBe('R-002');
  });

  it('distance outside the radius prevents a suggestion even with matching hashes', () => {
    const combined = combineDuplicateSignals(300, 10_000, 10_000, 250);
    expect(combined.factors.geoBps).toBe(0);
    expect(combined.suggested).toBe(false);
    expect(combined.confidenceBps).toBe(7_000);
  });
});
