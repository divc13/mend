import { z } from 'zod';
import { HASH_PATTERN, isNearAccount } from '@mend/protocol';

const datetime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'invalid ISO datetime');

export const ChecklistItemSchema = z
  .object({
    code: z.string().regex(/^[a-z][a-z0-9_]{2,40}$/),
    label: z.string().min(1).max(200),
    required: z.boolean(),
  })
  .strict();

export const EvidenceItemSchema = z
  .object({
    code: z.string().regex(/^[a-z][a-z0-9_]{2,40}$/),
    kind: z.enum(['photo', 'video', 'receipt', 'note']),
    sha256: z.string().regex(HASH_PATTERN),
    redacted: z.literal(true),
    capturedAt: datetime.optional(),
  })
  .strict();

export const EvidenceManifestSchema = z
  .object({
    workOrderId: z.string().min(3).max(120),
    evidenceId: z.string().min(3).max(120),
    submittedBy: z.string().refine(isNearAccount, 'invalid NEAR account'),
    checklist: z.array(ChecklistItemSchema).min(1).max(50),
    submittedItems: z.array(EvidenceItemSchema).max(100),
    /** Untrusted free text; reviewed as data only and never copied to output. */
    notes: z.string().max(4000).optional(),
  })
  .strict();

export const EvidenceReviewResultSchema = z
  .object({
    reviewVersion: z.literal('mend-evidence-review-v1'),
    workOrderId: z.string(),
    evidenceId: z.string(),
    missingChecklistItems: z.array(z.string()),
    limitations: z.array(z.string()).min(1),
    advisoryOnly: z.literal(true),
    humanDecisionRequired: z.literal(true),
    signature: z.literal(false),
  })
  .strict();

export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type EvidenceManifest = z.infer<typeof EvidenceManifestSchema>;
export type EvidenceReviewResult = z.infer<typeof EvidenceReviewResultSchema>;

/** Canonical completion checklist used by the recorded demo manifest. */
export const DEFAULT_COMPLETION_CHECKLIST: readonly ChecklistItem[] = [
  { code: 'before_photo', label: 'Before photo of the damaged seat and armrest', required: true },
  { code: 'after_photo', label: 'After photo from the same angle', required: true },
  { code: 'fastener_closeup', label: 'Close-up of the new fasteners and rounded edge', required: true },
  { code: 'materials_receipt', label: 'Materials receipt', required: true },
  { code: 'completion_note', label: 'Contractor completion note', required: true },
];

export const DEFAULT_LIMITATIONS: readonly string[] = [
  'Evidence text and redacted hashes were reviewed for checklist presence only',
  'Physical condition was not inspected',
  'A human inspector must make the final decision',
];
