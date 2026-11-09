import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { assertNoCertificationLanguage, enforceTrustedAction } from '../src/promptGuard.js';
import {
  EvidenceReviewSchema,
  reviewEvidence,
} from '../src/evidenceReviewer.js';
import {
  ScopeSuggestionSchema,
  generateScope,
  sealScope,
} from '../src/scopeGenerator.js';
import { RecordedChatClient } from '../src/recorded.js';
import type { TrustedActionContext } from '../src/promptGuard.js';

const SCOPE_FIXTURE = fileURLToPath(
  new URL('../../../fixtures/recorded-responses/near-ai/scope.json', import.meta.url),
);
const REVIEW_FIXTURE = fileURLToPath(
  new URL('../../../fixtures/recorded-responses/near-ai/evidence-review.json', import.meta.url),
);
const ATTACK_RESPONSE = fileURLToPath(
  new URL('../../../fixtures/attacks/prompt-injection/model-response-recipient-change.json', import.meta.url),
);
const ATTACK_ACCEPTANCE = fileURLToPath(
  new URL('../../../fixtures/attacks/prompt-injection/model-response-acceptance.json', import.meta.url),
);

const CHECKLIST = [
  'Before photo of the damaged seat and armrest',
  'After photo from the same angle',
  'Close-up of the new fasteners and rounded edge',
  'Materials receipt',
  'Contractor completion note',
] as const;

const TRUSTED: TrustedActionContext = {
  actorRole: 'REVIEWER_AI',
  recipient: 'contractor-b.mend.testnet',
  scopeHash: 'c'.repeat(64),
  payoutRule: '9000/1000 completion/holdback',
  acceptance: 'HUMAN_ONLY',
};

describe('scope generator', () => {
  it('returns a strict, editable, human-review-only scope from a recorded response', async () => {
    const client = RecordedChatClient.fromFile(SCOPE_FIXTURE);
    const generated = await generateScope(client, {
      assetId: 'BENCH-001',
      assetType: 'bench',
      description: 'The seat plank is cracked and one armrest is loose. Sharp edge exposed.',
      publicLocationLabel: 'Riverside Park, bench near east gate',
    });

    expect(generated.transport).toBe('recorded');
    expect(generated.humanReviewRequired).toBe(true);
    expect(generated.suggestion.humanReviewRequired).toBe(true);
    expect(generated.suggestion.tasks.length).toBeGreaterThan(0);
    expect(generated.suggestion.safetyExclusions.length).toBeGreaterThan(0);
    expect(generated.suggestion.requiredEvidence.length).toBeGreaterThan(0);
    expect(generated.suggestion.budgetRecommendationMicro).toBe('80000000');
    expect(generated.suggestionHash).toMatch(/^[a-f0-9]{64}$/);

    const keys = Object.keys(generated.suggestion).sort();
    expect(keys).toEqual(
      [
        'assumptions',
        'budgetRecommendationMicro',
        'humanReviewRequired',
        'requiredEvidence',
        'safetyExclusions',
        'summary',
        'tasks',
      ].sort(),
    );
    expect(keys).not.toContain('recipient');
    expect(keys).not.toContain('payoutRule');
    expect(keys).not.toContain('accepted');
    expect(keys).not.toContain('scopeHash');
  });

  it('rejects excluded electrical/structural scopes', async () => {
    const client = RecordedChatClient.fromFile(SCOPE_FIXTURE);
    await expect(
      generateScope(client, {
        assetId: 'BENCH-001',
        assetType: 'bench',
        description: 'Replace the electrical wiring and mains supply near the bench.',
      }),
    ).rejects.toThrow(/electrical, gas, structural/i);
  });

  it('only creates a sealed hash through the trusted human sealing step', async () => {
    const client = RecordedChatClient.fromFile(SCOPE_FIXTURE);
    const generated = await generateScope(client, {
      assetId: 'BENCH-001',
      assetType: 'bench',
      description: 'The seat plank is cracked.',
    });

    const sealed = sealScope('BENCH-001', generated.suggestion, {}, 'steward.mend.testnet');
    const sealedAgain = sealScope('BENCH-001', generated.suggestion, {}, 'steward.mend.testnet');
    expect(sealed.scopeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(sealed.scopeHash).toBe(sealedAgain.scopeHash);
    expect(sealed.humanEdited).toBe(false);

    const edited = sealScope(
      'BENCH-001',
      generated.suggestion,
      { budgetRecommendationMicro: '75000000' },
      'steward.mend.testnet',
    );
    expect(edited.humanEdited).toBe(true);
    expect(edited.editedFields).toEqual(['budgetRecommendationMicro']);
    expect(edited.scopeHash).not.toBe(sealed.scopeHash);

    // The model cannot supply a scope hash: the schema is strict.
    expect(
      ScopeSuggestionSchema.safeParse({ ...generated.suggestion, scopeHash: '0'.repeat(64) }).success,
    ).toBe(false);
  });
});

describe('evidence reviewer', () => {
  it('returns only missing trusted checklist items and no acceptance', async () => {
    const client = RecordedChatClient.fromFile(REVIEW_FIXTURE);
    const result = await reviewEvidence(client, {
      workOrderId: 'WO-BENCH-001-0001',
      checklist: CHECKLIST,
      evidence: [
        {
          evidenceId: 'EV-0001',
          kind: 'COMPLETION',
          description: 'After photo of the repaired bench seat from the same angle.',
          redactedHashes: ['a'.repeat(64)],
        },
      ],
      claimedChecklistItems: ['After photo from the same angle'],
    });

    expect(result.transport).toBe('recorded');
    expect(result.review.humanDecisionRequired).toBe(true);
    expect(result.review.missingChecklistItems).toEqual([
      'Close-up of the new fasteners and rounded edge',
      'Materials receipt',
      'Contractor completion note',
    ]);
    for (const item of result.review.missingChecklistItems) {
      expect(CHECKLIST).toContain(item);
    }
    expect(JSON.stringify(result.review)).not.toMatch(/approved|certified|passed/i);
  });

  it('rejects a model that invents a checklist item', async () => {
    const fixture = JSON.parse(readFileSync(REVIEW_FIXTURE, 'utf8')) as {
      response: { choices: Array<{ message: { content: string } }> };
    };
    fixture.response.choices[0]!.message.content = JSON.stringify({
      missingChecklistItems: ['A made-up item'],
      limitations: [],
      humanDecisionRequired: true,
    });
    const client = new RecordedChatClient({
      meta: {
        recorded: true,
        replayLabel: 'REPLAY / SIMULATION',
        kind: 'evidence-completeness-review',
      },
      request: { model: 'z-ai/glm-5.3-flash', messages: [{ role: 'user', content: 'x' }] },
      response: fixture.response,
    });
    await expect(
      reviewEvidence(client, {
        workOrderId: 'WO-BENCH-001-0001',
        checklist: CHECKLIST,
        evidence: [
          {
            evidenceId: 'EV-0001',
            kind: 'COMPLETION',
            description: 'After photo.',
            redactedHashes: ['a'.repeat(64)],
          },
        ],
      }),
    ).rejects.toThrow(/not in the trusted checklist/);
  });
});

describe('adversarial model output', () => {
  it('cannot add recipient, payout, role, scope hash or acceptance fields', () => {
    const attack = JSON.parse(readFileSync(ATTACK_RESPONSE, 'utf8')) as {
      attemptedOutput: Record<string, unknown>;
    };
    expect(ScopeSuggestionSchema.safeParse(attack.attemptedOutput).success).toBe(false);
    expect(() => enforceTrustedAction(attack.attemptedOutput, TRUSTED)).toThrow(
      /protected action field/,
    );
  });

  it('cannot emit physical-safety certification or approval language', () => {
    const attack = JSON.parse(readFileSync(ATTACK_ACCEPTANCE, 'utf8')) as {
      attemptedOutput: Record<string, unknown>;
    };
    expect(EvidenceReviewSchema.safeParse(attack.attemptedOutput).success).toBe(false);
    expect(() =>
      assertNoCertificationLanguage(JSON.stringify(attack.attemptedOutput)),
    ).toThrow(/certification language/);
  });

  it('returns the unchanged trusted context for benign output', () => {
    expect(enforceTrustedAction({ missingChecklistItems: [] }, TRUSTED)).toEqual(TRUSTED);
  });
});
