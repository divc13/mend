import { EvidencePackageSchema, ReportSchema } from '@mend/protocol';
import type { EvidencePackage, Report } from '@mend/protocol';

/**
 * Shared on-chain/off-chain records are validated with the frozen
 * `@mend/protocol` zod schemas. AI-only output schemas are colocated in this
 * package because the protocol deliberately does not contract model output.
 */
export function validateProtocolReport(value: unknown): Report {
  return ReportSchema.parse(value);
}

export function validateProtocolEvidencePackage(value: unknown): EvidencePackage {
  return EvidencePackageSchema.parse(value);
}
