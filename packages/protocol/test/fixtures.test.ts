import { describe, expect, it } from 'vitest';
import {
  AssetSchema,
  DaoApprovalSchema,
  ReportSchema,
  WorkOrderSchema,
} from '../src/schemas.js';
import {
  FIXTURE_ASSET_BENCH,
  FIXTURE_BID_INPUTS,
  FIXTURE_DAO_APPROVAL,
  FIXTURE_EXPECTED_MONEY,
  FIXTURE_REPORT_1,
  FIXTURE_WORK_ORDER,
} from '../src/fixtures.js';
import { bidCommitmentHash, policyHash, scoreInputHash, stableStringify } from '../src/hashing.js';
import { FIXTURE_POLICY } from '../src/fixtures.js';

describe('canonical fixtures and schemas', () => {
  it('parses all canonical fixtures', () => {
    expect(AssetSchema.parse(FIXTURE_ASSET_BENCH).id).toBe('BENCH-001');
    expect(ReportSchema.parse(FIXTURE_REPORT_1).id).toBe('R-001');
    expect(DaoApprovalSchema.parse(FIXTURE_DAO_APPROVAL).state).toBe('APPROVED');
    expect(WorkOrderSchema.parse(FIXTURE_WORK_ORDER).status).toBe('AWARDED');
  });

  it('rejects bad amounts, hashes and account names', () => {
    expect(() => DaoApprovalSchema.parse({ ...FIXTURE_DAO_APPROVAL, budgetMicro: '-1' })).toThrow();
    expect(() => DaoApprovalSchema.parse({ ...FIXTURE_DAO_APPROVAL, policyHash: 'xyz' })).toThrow();
    expect(() =>
      WorkOrderSchema.parse({ ...FIXTURE_WORK_ORDER, contractorId: 'Not A Near Account!' }),
    ).toThrow();
  });

  it('freezes canonical money values', () => {
    expect(FIXTURE_EXPECTED_MONEY).toEqual({
      sponsorBudgetMicro: '100000000',
      winningBidMicro: '80000000',
      refundMicro: '20000000',
      completionPaymentMicro: '72000000',
      durabilityHoldbackMicro: '8000000',
    });
  });

  it('produces stable hashes and stable JSON', () => {
    const hashA = bidCommitmentHash(FIXTURE_BID_INPUTS.B);
    const hashB = bidCommitmentHash({ ...FIXTURE_BID_INPUTS.B });
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
    expect(bidCommitmentHash({ ...FIXTURE_BID_INPUTS.B, availableInDays: 99 })).not.toBe(hashA);
    expect(policyHash(FIXTURE_POLICY)).toMatch(/^[a-f0-9]{64}$/);
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(scoreInputHash('a'.repeat(64), ['b'.repeat(64), 'c'.repeat(64)])).toBe(
      scoreInputHash('a'.repeat(64), ['c'.repeat(64), 'b'.repeat(64)]),
    );
  });
});
