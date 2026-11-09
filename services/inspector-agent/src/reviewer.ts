import { z } from 'zod';
import { MendError, makeEvent } from '@mend/protocol';
import type { MendEvent } from '@mend/protocol';
import {
  assertNoCertificationLanguage,
  assertTrustedFieldsUnchanged,
  guardUntrustedText,
} from '@mend/near-client';
import {
  DEFAULT_LIMITATIONS,
  EvidenceManifestSchema,
  EvidenceReviewResultSchema,
} from './checklist.js';
import type { ChecklistItem, EvidenceManifest, EvidenceReviewResult } from './checklist.js';

export interface ReviewOutput {
  result: EvidenceReviewResult;
  auditEvents: readonly MendEvent[];
}

export interface ModelReviewContext {
  workOrderId: string;
  evidenceId: string;
  checklist: readonly ChecklistItem[];
}

const ModelReviewSchema = z
  .object({
    missingChecklistItems: z.array(z.string()).max(50),
    limitations: z.array(z.string()).min(1),
    humanDecisionRequired: z.literal(true),
  })
  .strict();

export class EvidenceReviewAssistant {
  readonly actor: string;
  private readonly clock: () => string;

  constructor(config: { actor: string; clock?: () => string }) {
    this.actor = config.actor;
    this.clock = config.clock ?? (() => new Date().toISOString());
  }

  /**
   * Compares a redacted manifest with the checklist. The result contains only
   * missing checklist codes plus limitations; it never certifies quality or
   * claims acceptance.
   */
  review(rawManifest: unknown): ReviewOutput {
    const manifest = EvidenceManifestSchema.parse(rawManifest);
    const auditEvents: MendEvent[] = [];

    if (manifest.notes) {
      const guarded = guardUntrustedText(manifest.notes, {
        source: 'evidence-notes',
        actor: this.actor,
        workOrderId: manifest.workOrderId,
        timestamp: this.clock(),
      });
      if (guarded.blockedEvent) auditEvents.push(guarded.blockedEvent);
    }

    const submittedCodes = new Set(manifest.submittedItems.map((item) => item.code));
    const missingChecklistItems = manifest.checklist
      .filter((item) => item.required && !submittedCodes.has(item.code))
      .map((item) => item.code);

    const result = EvidenceReviewResultSchema.parse({
      reviewVersion: 'mend-evidence-review-v1',
      workOrderId: manifest.workOrderId,
      evidenceId: manifest.evidenceId,
      missingChecklistItems,
      limitations: [...DEFAULT_LIMITATIONS],
      advisoryOnly: true,
      humanDecisionRequired: true,
      signature: false,
    });

    this.assertSafeOutput(result);
    return { result, auditEvents };
  }

  /**
   * Validates a model-generated completeness response. Strict schema plus
   * protected-field and certification-language guards mean an injected model
   * response cannot change a recipient, role, scope or acceptance decision.
   */
  validateModelOutput(candidate: unknown, context: ModelReviewContext): EvidenceReviewResult {
    assertTrustedFieldsUnchanged(candidate, { role: 'REVIEWER_AI', accepted: 'HUMAN_ONLY' });
    const parsed = ModelReviewSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new MendError('VALIDATION_ERROR', 'model review output did not match the strict completeness schema', {
        issues: parsed.error.issues.map((issue) => issue.path.join('.')),
      });
    }
    const knownCodes = new Set(context.checklist.map((item) => item.code));
    for (const code of parsed.data.missingChecklistItems) {
      if (!knownCodes.has(code)) {
        throw new MendError('VALIDATION_ERROR', `model reported an unknown checklist code: ${code}`);
      }
    }

    const result = EvidenceReviewResultSchema.parse({
      reviewVersion: 'mend-evidence-review-v1',
      workOrderId: context.workOrderId,
      evidenceId: context.evidenceId,
      missingChecklistItems: parsed.data.missingChecklistItems,
      limitations: parsed.data.limitations,
      advisoryOnly: true,
      humanDecisionRequired: true,
      signature: false,
    });
    this.assertSafeOutput(result);
    return result;
  }

  private assertSafeOutput(result: EvidenceReviewResult): void {
    const serialized = JSON.stringify(result);
    assertNoCertificationLanguage(serialized);
    assertTrustedFieldsUnchanged(result, { role: 'REVIEWER_AI', accepted: 'HUMAN_ONLY' });
    if (!result.advisoryOnly || !result.humanDecisionRequired || result.signature !== false) {
      throw new MendError('FORBIDDEN_ROLE', 'review output attempted to claim authority');
    }
  }
}
