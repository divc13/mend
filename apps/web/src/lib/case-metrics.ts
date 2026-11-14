import type { PublicMetrics } from './fixtures';
import type { CaseBundle } from './types';

function microSum(cases: CaseBundle[], pick: (caseData: CaseBundle) => string): bigint {
  return cases.reduce((total, caseData) => {
    try {
      return total + BigInt(pick(caseData));
    } catch {
      return total;
    }
  }, 0n);
}

/**
 * Computes the same public dashboard shape from an arbitrary case set.
 *
 * This lets the public pages show live API records without borrowing fixture
 * totals. Every value is derived from the supplied records; nothing is filled
 * in from the frozen replay bundle.
 */
export function metricsForCases(cases: CaseBundle[], assetCount?: number): PublicMetrics {
  const statusCounts = new Map<CaseBundle['status'], number>();
  for (const caseData of cases) {
    statusCounts.set(caseData.status, (statusCounts.get(caseData.status) ?? 0) + 1);
  }

  const attestations = cases.flatMap((caseData) => caseData.attestations);
  const physicalClaims = cases.reduce(
    (total, caseData) =>
      total + caseData.events.filter((event) => event.evidence?.some((item) => item.kind === 'PHYSICAL')).length,
    0,
  );
  const confirmedClusters = cases.filter((caseData) => caseData.cluster?.status === 'CONFIRMED').length;

  return {
    assets: assetCount ?? new Set(cases.map((caseData) => caseData.assetId)).size,
    cases: cases.length,
    reports: cases.reduce((total, caseData) => total + caseData.reports.length, 0),
    duplicateClusters: confirmedClusters,
    fundedMicro: microSum(cases, (caseData) => caseData.escrow.fundedMicro).toString(),
    refundedMicro: microSum(cases, (caseData) => caseData.escrow.refundedMicro).toString(),
    completionPaidMicro: microSum(cases, (caseData) => caseData.escrow.completionPaidMicro).toString(),
    holdbackReleasedMicro: microSum(cases, (caseData) => caseData.escrow.holdbackReleasedMicro).toString(),
    holdbackHeldMicro: microSum(cases, (caseData) => caseData.escrow.holdbackHeldMicro).toString(),
    reopenedCases: cases.filter((caseData) => caseData.reopenCount > 0).length,
    humanDecisions:
      cases.reduce((total, caseData) => total + caseData.inspections.length, 0) + confirmedClusters,
    evidenceUnavailable: attestations.filter((item) => !item.verified).length,
    verifiedEvidence: attestations.filter((item) => item.verified).length,
    physicalClaims,
    statusDistribution: [...statusCounts.entries()].map(([status, count]) => ({ status, count })),
  };
}
