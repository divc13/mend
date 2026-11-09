import { FIXTURE_REPORT_1 } from '@mend/protocol';
import { describe, expect, it } from 'vitest';

import { validateProtocolEvidencePackage, validateProtocolReport } from '../src/protocol.js';

describe('protocol schema validation', () => {
  it('accepts canonical protocol records', () => {
    expect(validateProtocolReport(FIXTURE_REPORT_1).id).toBe('R-001');
    const evidence = validateProtocolEvidencePackage({
      id: 'EV-0001',
      workOrderId: 'WO-BENCH-001-0001',
      kind: 'COMPLETION',
      evidenceHashes: ['a'.repeat(64)],
      checklist: { 'Before photo': true, 'After photo': true },
      redacted: true,
      submittedBy: 'contractor-b.mend.testnet',
      submittedAt: '2026-11-10T11:00:00.000Z',
    });
    expect(evidence.redacted).toBe(true);
  });

  it('rejects non-protocol records instead of accepting free-form JSON', () => {
    expect(() => validateProtocolReport({ id: 'R-999', description: 'missing fields' })).toThrow();
    expect(() =>
      validateProtocolEvidencePackage({
        id: 'EV-BAD',
        workOrderId: 'WO-BENCH-001-0001',
        kind: 'COMPLETION',
        evidenceHashes: ['not-a-hash'],
        checklist: {},
        redacted: true,
        submittedBy: 'contractor-b.mend.testnet',
        submittedAt: '2026-11-10T11:00:00.000Z',
      }),
    ).toThrow();
  });
});
