import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { call, makeTestApp, seedDemo } from './helpers.js';

describe('public case read model', () => {
  it('returns an empty list and clean 404s before any case exists', async () => {
    const target = await makeTestApp();
    try {
      const list = await call(target.app, 'GET', '/v1/cases');
      expect(list.status).toBe(200);
      expect(list.body).toEqual([]);

      const detail = await call(target.app, 'GET', '/v1/cases/WO-BENCH-001-0001');
      expect(detail.status).toBe(404);
      expect(detail.body.error.code).toBe('NOT_FOUND');

      const byAsset = await call(target.app, 'GET', '/v1/cases/by-asset/BENCH-001');
      expect(byAsset.status).toBe(404);
      expect(byAsset.body.error.code).toBe('NOT_FOUND');

      const badQuery = await call(target.app, 'GET', '/v1/cases?status=NOT_A_STATE');
      expect(badQuery.status).toBe(400);
      expect(badQuery.body.error.code).toBe('VALIDATION_ERROR');
    } finally {
      await target.close();
    }
  });

  it('serves a CaseBundle-shaped closed case without private report data', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target, 'closed');

      const list = await call(target.app, 'GET', '/v1/cases');
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0]).toMatchObject({
        id: 'WO-BENCH-001-0001',
        assetId: 'BENCH-001',
        status: 'CLOSED',
        mode: 'REPLAY',
        budgetMicro: '100000000',
        winningBidMicro: '80000000',
        refundMicro: '20000000',
        completionPaymentMicro: '72000000',
        holdbackMicro: '8000000',
        reportCount: 2,
        evidenceCount: 1,
      });
      expect(list.body[0].asset).toMatchObject({
        id: 'BENCH-001',
        assetType: 'bench',
        transferable: false,
        owner: 'mend-dao.sputnikv2.testnet',
      });
      expect(list.body[0].labels.title).toContain('asset.publicDescription');

      const detail = await call(target.app, 'GET', '/v1/cases/WO-BENCH-001-0001');
      expect(detail.status).toBe(200);
      const bundle = detail.body;

      expect(bundle).toMatchObject({
        id: 'WO-BENCH-001-0001',
        assetId: 'BENCH-001',
        status: 'CLOSED',
        mode: 'REPLAY',
        policyHash: bundle.daoApproval.policyHash,
        fundingToken: 'mend-usdc.testnet',
        reopenCount: 0,
      });
      expect(bundle.workOrder).toMatchObject({
        id: 'WO-BENCH-001-0001',
        reportClusterId: 'CL-0001',
        daoApprovalId: 'dao-42',
      });
      expect(bundle.scope).toContain('scopeHash');
      expect(bundle.labels.title).toBeTruthy();
      expect(bundle.labels.summary).toBeTruthy();
      expect(bundle.labels.scope).toBe(bundle.scope);
      expect(bundle.unavailable).toContain('scope');
      expect(bundle.unavailable).toContain('intent');

      expect(bundle.reports).toHaveLength(2);
      for (const report of bundle.reports) {
        expect(report.reporterCaseLink).toBe('case_link_protected');
      }
      expect(bundle.cluster).toMatchObject({ id: 'CL-0001', status: 'CONFIRMED' });
      expect(bundle.commitments).toHaveLength(3);
      expect(bundle.reveals).toHaveLength(3);

      expect(bundle.score.ranking[0]).toMatchObject({
        rank: 1,
        bidId: 'BID-B-BENCH-001',
        contractorId: 'contractor-b.mend.testnet',
        scoreBps: 9270,
        priceMicro: '80000000',
        durationDays: 10,
        warrantyDays: 180,
        availableInDays: 2,
        materialsScore: 80,
      });
      expect(bundle.score.ranking[0].dimensions).toMatchObject({
        price: expect.any(Number),
        warranty: expect.any(Number),
        duration: expect.any(Number),
        materials: expect.any(Number),
      });

      expect(bundle.evidence).toHaveLength(1);
      expect(bundle.evidence[0].checklist).toEqual(
        expect.arrayContaining([{ label: 'beforePhoto', complete: true }]),
      );
      expect(bundle.inspections).toHaveLength(2);
      expect(bundle.escrow).toMatchObject({
        token: 'mend-usdc.testnet',
        fundedMicro: '100000000',
        refundedMicro: '20000000',
        completionPaidMicro: '72000000',
        holdbackHeldMicro: '0',
        holdbackReleasedMicro: '8000000',
      });
      expect(bundle.escrow.escrowedMicro).toBeUndefined();
      expect(bundle.payments).toHaveLength(3);
      expect(bundle.warranty).toBeUndefined();

      expect(bundle.attestations).toHaveLength(1);
      expect(bundle.attestations[0]).toMatchObject({
        kind: 'LOCAL_REPLAY',
        // The stored artifact hash is not a hash of the full artifact object,
        // so the re-hash-on-read check (same as /v1/verification) reports false.
        verified: false,
      });
      expect(bundle.attestations[0].detail).toContain('Not an OutLayer execution');

      expect(bundle.events.length).toBeGreaterThan(0);
      expect(bundle.events.some((event: any) => event.kind === 'award')).toBe(true);
      expect(bundle.intent).toBeUndefined();

      const serialized = JSON.stringify(bundle);
      expect(serialized).not.toContain('case_7J2mQ9xLk4Pz1VbN');
      expect(serialized).not.toContain('52.520001');
      expect(serialized).not.toContain('privateMediaKey');
      expect(serialized).not.toContain('storageKey');
      expect(serialized).not.toContain('secret');
    } finally {
      await target.close();
    }
  });

  it('groups cases by asset and exposes warranty plus linked Intents state', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target, 'failedDurability');
      await target.deps.repo.createIntentQuote({
        id: 'IQ-0001',
        dry: true,
        srcChain: 'Ethereum',
        srcAsset: 'USDC (ERC-20)',
        dstChain: 'near',
        dstAsset: 'USDC on NEAR',
        amountIn: '100.00',
        amountOut: '98.72',
        feesUsd: 1.28,
        recipient: 'mend-sponsor.testnet',
        depositAddress: '0x7A3f9c2E14bD8a05C6f1Ae93D2b7C4e08F5a1B6d',
        depositMemo: 'MEND-WO-BENCH-001-0001',
        deadline: '2026-11-10T09:05:00.000Z',
        status: 'PENDING',
        workOrderId: 'WO-BENCH-001-0001',
        createdAt: '2026-11-10T09:00:00.000Z',
        isDemo: true,
      });
      await target.deps.repo.createIntentExecution({
        id: 'IE-0001',
        quoteId: 'IQ-0001',
        workOrderId: 'WO-BENCH-001-0001',
        status: 'SUCCESS',
        destinationTxHash: '4'.repeat(64),
        explorerUrl: `https://explorer.testnet.near.org/transactions/${'4'.repeat(64)}`,
        updatedAt: '2026-11-10T09:06:00.000Z',
        isDemo: true,
      });

      const byAsset = await call(target.app, 'GET', '/v1/cases/by-asset/BENCH-001');
      expect(byAsset.status).toBe(200);
      expect(byAsset.body.asset).toMatchObject({ id: 'BENCH-001', assetType: 'bench' });
      expect(byAsset.body.cases).toHaveLength(1);
      expect(byAsset.body.cases[0]).toMatchObject({
        id: 'WO-BENCH-001-0001',
        status: 'WARRANTY_REOPENED',
        reopenCount: 1,
      });

      const emptyAsset = await call(target.app, 'GET', '/v1/cases/by-asset/RACK-002');
      expect(emptyAsset.status).toBe(200);
      expect(emptyAsset.body.asset.id).toBe('RACK-002');
      expect(emptyAsset.body.cases).toEqual([]);

      const filtered = await call(target.app, 'GET', '/v1/cases?assetId=BENCH-001');
      expect(filtered.status).toBe(200);
      expect(filtered.body).toHaveLength(1);

      const detail = await call(target.app, 'GET', '/v1/cases/WO-BENCH-001-0001');
      expect(detail.status).toBe(200);
      const bundle = detail.body;

      expect(bundle.status).toBe('WARRANTY_REOPENED');
      expect(bundle.warranty).toMatchObject({
        id: 'WC-0001',
        state: 'OPEN',
        failedInspectionId: 'INS-0002',
      });
      expect(bundle.warranty.note).toContain('not stored');
      expect(bundle.warranties).toHaveLength(1);
      expect(bundle.events.some((event: any) => event.kind === 'warranty')).toBe(true);

      expect(bundle.intent).toMatchObject({
        id: 'IQ-0001',
        dry: true,
        dstChain: 'near',
        status: 'SUCCESS',
        destinationTxHash: '4'.repeat(64),
        feesUsd: 1.28,
        updatedAt: '2026-11-10T09:06:00.000Z',
      });
      expect(bundle.intent.explorerUrl).toContain('explorer.testnet.near.org');
      expect(bundle.unavailable).not.toContain('intent');
      expect(JSON.stringify(bundle)).not.toContain('case_7J2mQ9xLk4Pz1VbN');
    } finally {
      await target.close();
    }
  });

  it('serves read-only cases in LIVE_TESTNET while the live runner stays disabled by default', async () => {
    const evidenceDir = await mkdtemp(path.join(os.tmpdir(), 'mend-cases-live-'));
    const config = loadConfig({
      NODE_ENV: 'test',
      MEND_MODE: 'LIVE_TESTNET',
      CHAIN_ADAPTER: 'unavailable',
      DEMO_RESET_ENABLED: 'true',
      EVIDENCE_DIR: evidenceDir,
      EVIDENCE_URL_SECRET: 'test-only-evidence-secret',
      PUBLIC_BASE_URL: 'http://127.0.0.1:4010',
    });
    const target = await makeTestApp({ config });
    try {
      expect(config.liveScenario.enabled).toBe(false);
      await seedDemo(target, 'closed');

      const list = await call(target.app, 'GET', '/v1/cases');
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(1);
      expect(list.headers['x-mend-mode']).toBe('LIVE_TESTNET');

      const detail = await call(target.app, 'GET', '/v1/cases/WO-BENCH-001-0001');
      expect(detail.status).toBe(200);
      expect(detail.body.mode).toBe('REPLAY');

      const runner = await call(target.app, 'POST', '/v1/live/run-scenario');
      expect(runner.status).toBe(404);
      expect(runner.body.error.code).toBe('NOT_FOUND');
    } finally {
      await target.close();
      await rm(evidenceDir, { recursive: true, force: true });
    }
  });
});
