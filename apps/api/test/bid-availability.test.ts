import { describe, expect, it } from 'vitest';
import { FIXTURE_ACCOUNTS, FIXTURE_IDS } from '@mend/protocol';
import { auth, call, makeTestApp } from './helpers.js';

function revealBody(availableInDays: number) {
  return {
    bidId: FIXTURE_IDS.bidA,
    contractorId: FIXTURE_ACCOUNTS.contractorA,
    priceMicro: '95000000',
    durationDays: 14,
    warrantyDays: 90,
    availableInDays,
    materials: 'fixture materials',
    materialsScore: 60,
    evidenceChecklistAccepted: true,
    nonce: 'nonce-a-0001',
  };
}

describe('MEND API — bid availability validation', () => {
  it('rejects negative and greater-than-365 availability before touching state', async () => {
    const target = await makeTestApp();
    try {
      for (const invalid of [-1, 366]) {
        const response = await call(
          target.app,
          'POST',
          `/v1/work-orders/${FIXTURE_IDS.workOrder}/bids/reveal`,
          {
            headers: auth('CONTRACTOR', FIXTURE_ACCOUNTS.contractorA),
            body: revealBody(invalid),
          },
        );
        expect(response.status, `availableInDays=${invalid}`).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.details.issues.some(
          (issue: { path: string }) => issue.path === 'availableInDays',
        )).toBe(true);
      }
    } finally {
      await target.close();
    }
  });
});
