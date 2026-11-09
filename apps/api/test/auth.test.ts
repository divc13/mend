import { describe, expect, it } from 'vitest';
import type { Role } from '@mend/protocol';
import { auth, call, makeTestApp, seedDemo } from './helpers.js';

interface Case {
  method: string;
  url: string;
  wrongRole: Role;
  name: string;
}

const MUTATING_CASES: Case[] = [
  { name: 'create asset', method: 'POST', url: '/v1/assets', wrongRole: 'CONTRACTOR' },
  { name: 'update asset', method: 'PATCH', url: '/v1/assets/BENCH-001', wrongRole: 'CONTRACTOR' },
  { name: 'delete asset', method: 'DELETE', url: '/v1/assets/RACK-002', wrongRole: 'CONTRACTOR' },
  { name: 'mint passport', method: 'POST', url: '/v1/assets/RACK-002/passport/mint', wrongRole: 'CONTRACTOR' },
  { name: 'update report', method: 'PATCH', url: '/v1/reports/R-001', wrongRole: 'CONTRACTOR' },
  { name: 'triage report', method: 'POST', url: '/v1/reports/R-001/triage', wrongRole: 'CONTRACTOR' },
  { name: 'create cluster', method: 'POST', url: '/v1/report-clusters', wrongRole: 'CONTRACTOR' },
  { name: 'update cluster', method: 'PATCH', url: '/v1/report-clusters/CL-0001', wrongRole: 'CONTRACTOR' },
  { name: 'create dao approval', method: 'POST', url: '/v1/dao-approvals', wrongRole: 'CONTRACTOR' },
  { name: 'create work order', method: 'POST', url: '/v1/work-orders', wrongRole: 'CONTRACTOR' },
  { name: 'work order action', method: 'POST', url: '/v1/work-orders/WO-BENCH-001-0001/actions/open_bidding', wrongRole: 'CONTRACTOR' },
  { name: 'commit bid', method: 'POST', url: '/v1/work-orders/WO-BENCH-001-0001/bids/commit', wrongRole: 'STEWARD' },
  { name: 'reveal bid', method: 'POST', url: '/v1/work-orders/WO-BENCH-001-0001/bids/reveal', wrongRole: 'STEWARD' },
  { name: 'record score', method: 'POST', url: '/v1/work-orders/WO-BENCH-001-0001/score', wrongRole: 'CONTRACTOR' },
  { name: 'upload evidence', method: 'POST', url: '/v1/evidence', wrongRole: 'REPORTER' },
  { name: 'upload evidence alias', method: 'POST', url: '/v1/work-orders/WO-BENCH-001-0001/evidence', wrongRole: 'REPORTER' },
  { name: 'create inspection', method: 'POST', url: '/v1/work-orders/WO-BENCH-001-0001/inspections', wrongRole: 'CONTRACTOR' },
  { name: 'record payment', method: 'POST', url: '/v1/work-orders/WO-BENCH-001-0001/payments', wrongRole: 'CONTRACTOR' },
  { name: 'create agent', method: 'POST', url: '/v1/agents', wrongRole: 'CONTRACTOR' },
  { name: 'create verification artifact', method: 'POST', url: '/v1/verification', wrongRole: 'CONTRACTOR' },
  { name: 'reset demo', method: 'POST', url: '/v1/demo/reset', wrongRole: 'STEWARD' },
  { name: 'quote intents', method: 'POST', url: '/v1/intents/quote', wrongRole: 'CONTRACTOR' },
];

describe('MEND API — demo role authorization matrix', () => {
  it('rejects every mutating endpoint with a wrong role', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);
      for (const testCase of MUTATING_CASES) {
        const response = await call(target.app, testCase.method, testCase.url, {
          headers: auth(testCase.wrongRole),
          body: {},
        });
        expect(response.status, `${testCase.name} should reject ${testCase.wrongRole}`).toBe(403);
        expect(response.body.error.code, `${testCase.name} error code`).toBe('FORBIDDEN_ROLE');
        expect(response.body.error.details.allowedRoles.length).toBeGreaterThan(0);
      }
    } finally {
      await target.close();
    }
  });

  it('requires a role header for every role-protected mutation', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);
      const protectedCalls = [
        { method: 'POST', url: '/v1/assets' },
        { method: 'POST', url: '/v1/work-orders' },
        { method: 'POST', url: '/v1/work-orders/WO-BENCH-001-0001/actions/open_bidding' },
        { method: 'POST', url: '/v1/evidence' },
        { method: 'POST', url: '/v1/demo/reset' },
        { method: 'POST', url: '/v1/verification' },
      ];
      for (const testCase of protectedCalls) {
        const response = await call(target.app, testCase.method, testCase.url, { body: {} });
        expect(response.status, `${testCase.url} without a role`).toBe(401);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      }
    } finally {
      await target.close();
    }
  });

  it('rejects unknown role headers and invalid accounts', async () => {
    const target = await makeTestApp();
    try {
      const invalidRole = await call(target.app, 'POST', '/v1/assets', {
        headers: { 'x-mend-role': 'SUPERUSER', 'x-mend-account': 'someone.mend.testnet' },
        body: {},
      });
      expect(invalidRole.status).toBe(401);
      expect(invalidRole.body.error.code).toBe('UNAUTHORIZED');
      expect(invalidRole.body.error.details.allowedRoles.length).toBeGreaterThan(5);

      const invalidAccount = await call(target.app, 'POST', '/v1/assets', {
        headers: { 'x-mend-role': 'STEWARD', 'x-mend-account': 'NOT A NEAR ACCOUNT' },
        body: {},
      });
      expect(invalidAccount.status).toBe(401);
    } finally {
      await target.close();
    }
  });

  it('enforces the role matrix for every work-order action', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);
      const cases: Array<{ action: string; wrongRole: Role }> = [
        { action: 'dao_authorize', wrongRole: 'STEWARD' },
        { action: 'fund', wrongRole: 'STEWARD' },
        { action: 'open_bidding', wrongRole: 'CONTRACTOR' },
        { action: 'close_bidding', wrongRole: 'CONTRACTOR' },
        { action: 'award', wrongRole: 'CONTRACTOR' },
        { action: 'start_work', wrongRole: 'STEWARD' },
        { action: 'submit_completion', wrongRole: 'STEWARD' },
        { action: 'accept_completion', wrongRole: 'STEWARD' },
        { action: 'inspect_durability', wrongRole: 'STEWARD' },
        { action: 'open_dispute', wrongRole: 'DAO' },
        { action: 'resolve_dispute', wrongRole: 'STEWARD' },
        { action: 'cancel_work_order', wrongRole: 'CONTRACTOR' },
        { action: 'refund', wrongRole: 'CONTRACTOR' },
        { action: 'pause', wrongRole: 'STEWARD' },
        { action: 'unpause', wrongRole: 'STEWARD' },
      ];
      for (const testCase of cases) {
        const response = await call(
          target.app,
          'POST',
          `/v1/work-orders/WO-BENCH-001-0001/actions/${testCase.action}`,
          { headers: auth(testCase.wrongRole), body: {} },
        );
        expect(response.status, `${testCase.action} with ${testCase.wrongRole}`).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN_ROLE');
      }
    } finally {
      await target.close();
    }
  });

  it('keeps walletless reporting open and enforces separation of duties', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);
      const report = await call(target.app, 'POST', '/v1/reports', {
        headers: auth('CONTRACTOR'),
        body: {
          assetId: 'BENCH-001',
          description: 'Walletless report with no role header',
          publicLocation: { label: 'Park', coarseLat: 52.52, coarseLng: 13.405 },
        },
      });
      expect(report.status).toBe(201);
      expect(report.body.reporterCaseLink).toMatch(/^case_/);

      // The awarded contractor must not sign their own completion inspection.
      const selfInspection = await call(target.app, 'POST', '/v1/work-orders/WO-BENCH-001-0001/inspections', {
        headers: auth('INSPECTOR', 'contractor-b.mend.testnet'),
        body: {
          kind: 'COMPLETION',
          decision: 'APPROVED',
          evidencePackageId: 'EV-0001',
        },
      });
      expect(selfInspection.status).toBe(403);
      expect(selfInspection.body.error.code).toBe('CONTRACTOR_SELF_INSPECTION');

      // A passport transfer always fails, even for the highest demo role.
      const transfer = await call(target.app, 'POST', '/v1/passport/BENCH-001/transfer', {
        headers: auth('ADMIN'),
      });
      expect(transfer.status).toBe(403);
      expect(transfer.body.error.code).toBe('TRANSFER_DISABLED');
    } finally {
      await target.close();
    }
  });
});
