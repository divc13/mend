import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MendError } from '@mend/protocol';
import { NearClientError } from '@mend/near-client';
import {
  EvidenceReviewAssistant,
  assertInspectorAssistantCannot,
  submitFinalAcceptance,
} from '../src/index.js';
import type { EvidenceManifest } from '../src/index.js';

const root = new URL('../../../fixtures/', import.meta.url);
const readJson = (path: string): unknown => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

const CLOCK = () => '2026-11-10T11:15:00.000Z';

function assistant() {
  return new EvidenceReviewAssistant({ actor: 'reviewer-ai.mend.testnet', clock: CLOCK });
}

describe('inspector / evidence-review agent', () => {
  it('returns only the missing checklist codes', () => {
    const fixture = readJson('agents/inspector/manifest.json') as { manifest: EvidenceManifest };
    const { result } = assistant().review(fixture.manifest);
    expect(result.missingChecklistItems).toEqual(['fastener_closeup', 'materials_receipt', 'completion_note']);
    expect(result.advisoryOnly).toBe(true);
    expect(result.humanDecisionRequired).toBe(true);
    expect(result.signature).toBe(false);
    expect(result).not.toHaveProperty('submittedItems');
    expect(JSON.stringify(result)).not.toMatch(/attacker|recipient|payout/i);
  });

  it('never emits safe/approved/structurally-sound certification language', () => {
    const fixture = readJson('agents/inspector/manifest.json') as { manifest: EvidenceManifest };
    const { result } = assistant().review(fixture.manifest);
    expect(JSON.stringify(result)).not.toMatch(/physically safe|structurally sound|safe to use|certified|passed inspection/i);
  });

  it('logs prompt injection in evidence notes and does not follow it', () => {
    const fixture = readJson('agents/inspector/manifest-attack.json') as { manifest: EvidenceManifest };
    const reviewer = assistant();
    const { result, auditEvents } = reviewer.review(fixture.manifest);
    expect(result.missingChecklistItems).toEqual(['fastener_closeup', 'materials_receipt', 'completion_note']);
    expect(auditEvents.some((event) => event.name === 'prompt_injection_blocked')).toBe(true);
    expect(auditEvents[0]?.data.categories).toContain('recipient-change');
  });

  it('accepts a recorded structured model review', () => {
    const fixture = readJson('agents/inspector/manifest.json') as { manifest: EvidenceManifest };
    const model = readJson('agents/inspector/model-review.json') as { output: unknown };
    const result = assistant().validateModelOutput(model.output, {
      workOrderId: fixture.manifest.workOrderId,
      evidenceId: fixture.manifest.evidenceId,
      checklist: fixture.manifest.checklist,
    });
    expect(result.missingChecklistItems).toEqual(['fastener_closeup', 'materials_receipt', 'completion_note']);
    expect(result.signature).toBe(false);
  });

  it('rejects an injected model response that claims acceptance or safety', () => {
    const attack = readJson('attacks/prompt-injection/model-response-acceptance.json') as { attemptedOutput: unknown };
    const fixture = readJson('agents/inspector/manifest.json') as { manifest: EvidenceManifest };
    expect(() =>
      assistant().validateModelOutput(attack.attemptedOutput, {
        workOrderId: fixture.manifest.workOrderId,
        evidenceId: fixture.manifest.evidenceId,
        checklist: fixture.manifest.checklist,
      }),
    ).toThrow(NearClientError);
  });

  it('rejects an injected model response that changes recipient/role/scope', () => {
    const attack = readJson('attacks/prompt-injection/model-response-recipient-change.json') as {
      attemptedOutput: unknown;
    };
    const fixture = readJson('agents/inspector/manifest.json') as { manifest: EvidenceManifest };
    expect(() =>
      assistant().validateModelOutput(attack.attemptedOutput, {
        workOrderId: fixture.manifest.workOrderId,
        evidenceId: fixture.manifest.evidenceId,
        checklist: fixture.manifest.checklist,
      }),
    ).toThrow(/protected action field|PROMPT_INJECTION/);
  });

  it('rejects unknown checklist codes from a model response', () => {
    const fixture = readJson('agents/inspector/manifest.json') as { manifest: EvidenceManifest };
    expect(() =>
      assistant().validateModelOutput(
        {
          missingChecklistItems: ['made_up_item'],
          limitations: ['completeness only'],
          humanDecisionRequired: true,
        },
        {
          workOrderId: fixture.manifest.workOrderId,
          evidenceId: fixture.manifest.evidenceId,
          checklist: fixture.manifest.checklist,
        },
      ),
    ).toThrow(MendError);
  });

  it('rejects private URLs, unredacted media and precise locations in a manifest', () => {
    const fixture = readJson('agents/inspector/manifest.json') as { manifest: EvidenceManifest };
    const base = fixture.manifest;
    expect(() =>
      assistant().review({
        ...base,
        preciseLocation: { lat: 52.520001, lng: 13.405001 },
      }),
    ).toThrow();
    expect(() =>
      assistant().review({
        ...base,
        submittedItems: [{ ...base.submittedItems[0], redacted: false }],
      }),
    ).toThrow();
    expect(() =>
      assistant().review({
        ...base,
        submittedItems: [{ ...base.submittedItems[0], sha256: 'https://private.example/evidence.jpg' }],
      }),
    ).toThrow();
  });

  it('cannot submit final acceptance or call any hub mutating method', () => {
    expect(() => submitFinalAcceptance()).toThrow(MendError);
    for (const method of ['accept_completion', 'inspect_durability', 'award', 'refund', 'commit_bid', 'set_role']) {
      expect(() => assertInspectorAssistantCannot(method)).toThrow(MendError);
    }
  });
});
