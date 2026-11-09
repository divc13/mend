import { z } from 'zod';
import { MendError } from '@mend/protocol';
import { ADVISORY_DISCLOSURE } from './publish.js';

export const CompletenessDeliverableInputSchema = z
  .object({
    workOrderId: z.string().min(3).max(120),
    evidenceId: z.string().min(3).max(120),
    missingChecklistItems: z.array(z.string().regex(/^[a-z][a-z0-9_]{2,40}$/)).max(50),
    limitations: z.array(z.string()).min(1),
  })
  .strict();

export interface FormattedDeliverable {
  deliverableMarkdown: string;
  machineReadable: Record<string, unknown>;
}

/**
 * Marketplace deliverable: human-readable Markdown plus a machine-readable
 * block. It reports missing items and states that it is advisory only.
 */
export function formatDeliverable(input: unknown): FormattedDeliverable {
  const parsed = CompletenessDeliverableInputSchema.parse(input);
  const machineReadable = {
    review_version: 'mend-evidence-review-v1',
    work_order_id: parsed.workOrderId,
    evidence_id: parsed.evidenceId,
    missing_items: parsed.missingChecklistItems,
    limitations: parsed.limitations,
    advisory_only: true,
    human_decision_required: true,
    not_a_certification: true,
  };
  const markdown = [
    '# Evidence completeness review',
    '',
    'Advisory completeness only. This is not a physical inspection and not an acceptance decision.',
    '',
    parsed.missingChecklistItems.length === 0
      ? 'No required checklist items are missing from the redacted manifest.'
      : `Missing checklist items: ${parsed.missingChecklistItems.join(', ')}.`,
    '',
    '## Limitations',
    ...parsed.limitations.map((limitation) => `- ${limitation}`),
    '',
    '```json',
    JSON.stringify(machineReadable, null, 2),
    '```',
    '',
    ADVISORY_DISCLOSURE,
  ].join('\n');

  if (Buffer.byteLength(markdown, 'utf8') > 256 * 1024) {
    throw new MendError('VALIDATION_ERROR', 'deliverable exceeds the marketplace 256 KiB limit');
  }
  return { deliverableMarkdown: markdown, machineReadable };
}
