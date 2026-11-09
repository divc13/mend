import { describe, expect, it } from 'vitest';
import { FIXTURE_ACCOUNTS, FIXTURE_BID_INPUTS, FIXTURE_IDS } from '@mend/protocol';
import { ChainCommandService, FailingChainAdapter, PendingChainAdapter, UnavailableChainAdapter } from '../src/services/chain.js';
import {
  auth,
  call,
  isoPlus,
  jpegWithExif,
  makeTestApp,
  seedDemo,
} from './helpers.js';

describe('MEND API — work-order lifecycle, sealed bids and honest chain commands', () => {
  it('runs the complete repair, sealed-bid award, 90/10 settlement and durability close', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);
      const steward = auth('STEWARD');
      const dao = auth('DAO');
      const sponsor = auth('SPONSOR');
      const contractorB = auth('CONTRACTOR', FIXTURE_ACCOUNTS.contractorB);
      const inspector = auth('INSPECTOR');

      const created = await call(target.app, 'POST', '/v1/work-orders', {
        headers: steward,
        body: {
          id: 'WO-BENCH-001-0002',
          assetId: 'BENCH-001',
          reportClusterId: 'CL-0001',
          scopeHash: 'c'.repeat(64),
          daoApprovalId: 'dao-42',
          commitDeadline: isoPlus(target.clock, 60_000),
          revealDeadline: isoPlus(target.clock, 120_000),
        },
      });
      expect(created.status).toBe(201);
      expect(created.body.status).toBe('DRAFT');

      const authorized = await call(target.app, 'POST', '/v1/work-orders/WO-BENCH-001-0002/actions/dao_authorize', {
        headers: dao,
        body: {},
      });
      expect(authorized.status).toBe(200);
      expect(authorized.body.workOrder.status).toBe('POLICY_APPROVED');

      const funded = await call(target.app, 'POST', '/v1/work-orders/WO-BENCH-001-0002/actions/fund', {
        headers: sponsor,
        body: { amountMicro: '100000000' },
      });
      expect(funded.status).toBe(200);
      expect(funded.body.workOrder.status).toBe('FUNDED');
      expect(funded.body.workOrder.sponsorId).toBe(FIXTURE_ACCOUNTS.sponsor);

      const opened = await call(target.app, 'POST', '/v1/work-orders/WO-BENCH-001-0002/actions/open_bidding', {
        headers: steward,
        body: {
          commitDeadline: isoPlus(target.clock, 60_000),
          revealDeadline: isoPlus(target.clock, 120_000),
        },
      });
      expect(opened.status).toBe(200);
      expect(opened.body.workOrder.status).toBe('BIDDING_OPEN');

      for (const key of ['A', 'B', 'C'] as const) {
        const bid = FIXTURE_BID_INPUTS[key];
        const committed = await call(target.app, 'POST', '/v1/work-orders/WO-BENCH-001-0002/bids/commit', {
          headers: auth('CONTRACTOR', bid.contractorId),
          body: {
            bidId: bid.bidId,
            contractorId: bid.contractorId,
            bid: {
              priceMicro: bid.priceMicro,
              durationDays: bid.durationDays,
              warrantyDays: bid.warrantyDays,
              availableInDays: bid.availableInDays,
              materials: 'fixture materials',
              materialsScore: bid.materialsScore,
              evidenceChecklistAccepted: bid.evidenceChecklistAccepted,
              nonce: bid.nonce,
            },
          },
        });
        expect(committed.status).toBe(201);
        expect(committed.body.commitmentHash).toMatch(/^[a-f0-9]{64}$/);
      }

      const beforeReveal = await call(target.app, 'GET', '/v1/work-orders/WO-BENCH-001-0002/bids');
      expect(beforeReveal.body.revealAvailable).toBe(false);
      expect(beforeReveal.body.reveals).toBeNull();
      expect(JSON.stringify(beforeReveal.body)).not.toContain('80000000');
      expect(beforeReveal.body.commitments).toHaveLength(3);

      target.clock.advance(61_000);
      for (const key of ['A', 'B', 'C'] as const) {
        const bid = FIXTURE_BID_INPUTS[key];
        const revealed = await call(target.app, 'POST', '/v1/work-orders/WO-BENCH-001-0002/bids/reveal', {
          headers: auth('CONTRACTOR', bid.contractorId),
          body: {
            bidId: bid.bidId,
            contractorId: bid.contractorId,
            priceMicro: bid.priceMicro,
            durationDays: bid.durationDays,
            warrantyDays: bid.warrantyDays,
            availableInDays: bid.availableInDays,
            materials: 'fixture materials',
            materialsScore: bid.materialsScore,
            evidenceChecklistAccepted: bid.evidenceChecklistAccepted,
            nonce: bid.nonce,
          },
        });
        expect(revealed.status).toBe(201);
        expect(revealed.body.availableInDays).toBe(bid.availableInDays);
      }

      const stillHidden = await call(target.app, 'GET', '/v1/work-orders/WO-BENCH-001-0002/bids');
      expect(stillHidden.body.revealAvailable).toBe(false);
      expect(stillHidden.body.reveals).toBeNull();

      target.clock.advance(61_000);
      const closed = await call(target.app, 'POST', '/v1/work-orders/WO-BENCH-001-0002/actions/close_bidding', {
        headers: steward,
        body: {},
      });
      expect(closed.status).toBe(200);
      expect(closed.body.workOrder.status).toBe('BIDDING_REVEAL');

      const publicBids = await call(target.app, 'GET', '/v1/work-orders/WO-BENCH-001-0002/bids');
      expect(publicBids.body.revealAvailable).toBe(true);
      expect(publicBids.body.reveals).toHaveLength(3);
      expect(publicBids.body.reveals.map((r: any) => r.priceMicro).sort()).toEqual(
        ['78000000', '80000000', '95000000'],
      );
      expect(publicBids.body.reveals.map((r: any) => r.availableInDays).sort((a: number, b: number) => a - b))
        .toEqual([2, 3, 5]);

      const scored = await call(target.app, 'POST', '/v1/work-orders/WO-BENCH-001-0002/score', {
        headers: steward,
        body: {},
      });
      expect(scored.status).toBe(200);
      expect(scored.body.workOrder.status).toBe('SCORED');
      expect(scored.body.verified).toBe(false);
      expect(scored.body.label).toBe('LOCAL_DETERMINISTIC_REPLAY');
      expect(scored.body.score.ranking[0]).toMatchObject({
        rank: 1,
        bidId: FIXTURE_IDS.bidB,
        contractorId: FIXTURE_ACCOUNTS.contractorB,
        scoreBps: 9270,
      });

      const awarded = await call(target.app, 'POST', '/v1/work-orders/WO-BENCH-001-0002/actions/award', {
        headers: steward,
        body: { bidId: FIXTURE_IDS.bidB },
      });
      expect(awarded.status).toBe(200);
      expect(awarded.body.workOrder.status).toBe('AWARDED');
      expect(awarded.body.workOrder.contractorId).toBe(FIXTURE_ACCOUNTS.contractorB);
      expect(awarded.body.payments).toHaveLength(1);
      expect(awarded.body.payments[0]).toMatchObject({
        kind: 'REFUND',
        amountMicro: '20000000',
        label: 'REPLAY / SIMULATION',
      });

      const started = await call(target.app, 'POST', '/v1/work-orders/WO-BENCH-001-0002/actions/start_work', {
        headers: contractorB,
        body: {},
      });
      expect(started.status).toBe(200);
      expect(started.body.workOrder.status).toBe('IN_PROGRESS');

      const uploaded = await call(target.app, 'POST', '/v1/work-orders/WO-BENCH-001-0002/evidence', {
        headers: contractorB,
        body: {
          workOrderId: 'WO-BENCH-001-0002',
          kind: 'COMPLETION',
          contentType: 'image/jpeg',
          dataBase64: jpegWithExif().toString('base64'),
          checklist: { beforePhoto: true, afterPhoto: true, materialsReceipt: true },
        },
      });
      expect(uploaded.status).toBe(201);
      expect(uploaded.body.evidenceHashes).toHaveLength(1);
      expect(JSON.stringify(uploaded.body)).not.toContain('storageKey');
      const evidenceId = uploaded.body.id;

      const inspection = await call(target.app, 'POST', '/v1/work-orders/WO-BENCH-001-0002/inspections', {
        headers: inspector,
        body: {
          kind: 'COMPLETION',
          decision: 'APPROVED',
          evidencePackageId: evidenceId,
          notesHash: '1'.repeat(64),
        },
      });
      expect(inspection.status).toBe(201);
      expect(inspection.body.inspectorId).toBe(FIXTURE_ACCOUNTS.inspector);

      const submitted = await call(target.app, 'POST', '/v1/work-orders/WO-BENCH-001-0002/actions/submit_completion', {
        headers: contractorB,
        body: { evidenceId },
      });
      expect(submitted.status).toBe(200);
      expect(submitted.body.workOrder.status).toBe('COMPLETION_SUBMITTED');
      expect(submitted.body.command.args.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(submitted.body.command.args)).not.toContain('storageKey');

      const accepted = await call(target.app, 'POST', '/v1/work-orders/WO-BENCH-001-0002/actions/accept_completion', {
        headers: inspector,
        body: { inspectionId: inspection.body.id },
      });
      expect(accepted.status).toBe(200);
      expect(accepted.body.workOrder.status).toBe('DURABILITY_PENDING');
      expect(accepted.body.payments).toHaveLength(1);
      expect(accepted.body.payments[0]).toMatchObject({ kind: 'COMPLETION', amountMicro: '72000000' });
      expect(accepted.body.workOrder.durabilityDueAt).toBeDefined();

      const durabilityInspection = await call(target.app, 'POST', '/v1/work-orders/WO-BENCH-001-0002/inspections', {
        headers: inspector,
        body: {
          kind: 'DURABILITY',
          decision: 'APPROVED',
          evidencePackageId: evidenceId,
          notesHash: '2'.repeat(64),
        },
      });
      expect(durabilityInspection.status).toBe(201);

      const closedOut = await call(target.app, 'POST', '/v1/work-orders/WO-BENCH-001-0002/actions/inspect_durability', {
        headers: inspector,
        body: { passed: true, inspectionId: durabilityInspection.body.id },
      });
      expect(closedOut.status).toBe(200);
      expect(closedOut.body.workOrder.status).toBe('CLOSED');
      expect(closedOut.body.payments[0]).toMatchObject({ kind: 'HOLDBACK', amountMicro: '8000000' });

      const payments = await call(target.app, 'GET', '/v1/work-orders/WO-BENCH-001-0002/payments');
      expect(payments.body.escrow).toMatchObject({
        fundedMicro: '100000000',
        refundedMicro: '20000000',
        completionPaidMicro: '72000000',
        holdbackHeldMicro: '0',
        holdbackReleasedMicro: '8000000',
      });
      const accounted = ['refundedMicro', 'completionPaidMicro', 'holdbackHeldMicro', 'holdbackReleasedMicro']
        .map((key) => BigInt(payments.body.escrow[key]))
        .reduce((sum, value) => sum + value, 0n);
      expect(accounted).toBe(100000000n);

      const audit = await call(target.app, 'GET', '/v1/audit', { headers: auth('ADMIN') });
      const names = audit.body.events.map((event: any) => event.name);
      for (const expected of [
        'work_order_created', 'policy_approved', 'work_order_funded', 'bidding_opened',
        'bid_committed', 'bid_revealed', 'score_recorded', 'work_order_awarded', 'work_started',
        'evidence_submitted', 'inspection_signed', 'completion_submitted', 'completion_accepted',
        'durability_passed', 'payment_released',
      ]) {
        expect(names, `missing audit event ${expected}`).toContain(expected);
      }

      const history = await call(target.app, 'GET', '/v1/assets/BENCH-001/history');
      expect(history.body.timeline).toHaveLength(2);
      const closedTimeline = history.body.timeline.find((t: any) => t.workOrder.id === 'WO-BENCH-001-0002');
      expect(closedTimeline.workOrder.status).toBe('CLOSED');
      expect(closedTimeline.escrow.holdbackReleasedMicro).toBe('8000000');
    } finally {
      await target.close();
    }
  });

  it('never applies an unsigned action and reports the command as INTENT', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);
      target.deps.commands = new ChainCommandService(
        new UnavailableChainAdapter('No signer configured; action remains INTENT'),
        target.deps.config,
        target.clock,
      );
      const approval = await target.deps.repo.getDaoApproval('dao-42');
      expect(approval).not.toBeNull();
      await target.deps.repo.createWorkOrder({
        id: 'WO-BENCH-001-0003',
        assetId: 'BENCH-001',
        reportClusterId: 'CL-0001',
        scopeHash: 'c'.repeat(64),
        daoApprovalId: 'dao-42',
        policyHash: approval!.policyHash,
        budgetMicro: '100000000',
        status: 'FUNDED',
        mode: 'REPLAY',
        sponsorId: FIXTURE_ACCOUNTS.sponsor,
        fundingToken: FIXTURE_ACCOUNTS.token,
        reopenCount: 0,
        createdAt: '2026-11-10T09:00:00.000Z',
        updatedAt: '2026-11-10T09:00:00.000Z',
        isDemo: true,
      });
      const response = await call(target.app, 'POST', '/v1/work-orders/WO-BENCH-001-0003/actions/open_bidding', {
        headers: auth('STEWARD'),
        body: {},
      });
      expect(response.status).toBe(202);
      expect(response.body.applied).toBe(false);
      expect(response.body.command.state).toBe('INTENT');
      expect(response.body.command.realTransaction).toBe(false);
      expect(response.body.command.errorCode).toBe('UPSTREAM_UNAVAILABLE');
      const workOrder = await target.deps.repo.getWorkOrder('WO-BENCH-001-0003');
      expect(workOrder?.status).toBe('FUNDED');
      const commands = await target.deps.repo.listChainCommands('WO-BENCH-001-0003');
      expect(commands).toHaveLength(1);
      expect(commands[0]?.state).toBe('INTENT');
      const audit = await target.deps.repo.listAudit({ workOrderId: 'WO-BENCH-001-0003' });
      expect(audit.some((event) => event.name === 'chain_command_success')).toBe(false);
    } finally {
      await target.close();
    }
  });

  it('reopens the same work order after durability failure and remediation adds no new funds', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target, 'failedDurability');
      const workOrderId = 'WO-BENCH-001-0001';
      const contractorB = auth('CONTRACTOR', FIXTURE_ACCOUNTS.contractorB);
      const inspector = auth('INSPECTOR');

      const reopened = await target.deps.repo.getWorkOrder(workOrderId);
      expect(reopened?.status).toBe('WARRANTY_REOPENED');
      expect(reopened?.reopenCount).toBe(1);
      const before = await target.deps.repo.getEscrow(workOrderId);
      expect(before).toMatchObject({
        fundedMicro: '100000000',
        refundedMicro: '20000000',
        completionPaidMicro: '72000000',
        holdbackHeldMicro: '8000000',
        holdbackReleasedMicro: '0',
      });

      const started = await call(target.app, 'POST', `/v1/work-orders/${workOrderId}/actions/start_work`, {
        headers: contractorB,
        body: {},
      });
      expect(started.status).toBe(200);
      expect(started.body.workOrder.status).toBe('IN_PROGRESS');

      const uploaded = await call(target.app, 'POST', `/v1/work-orders/${workOrderId}/evidence`, {
        headers: contractorB,
        body: {
          workOrderId,
          kind: 'REMEDIATION',
          contentType: 'image/jpeg',
          dataBase64: jpegWithExif().toString('base64'),
        },
      });
      expect(uploaded.status).toBe(201);

      const submitted = await call(target.app, 'POST', `/v1/work-orders/${workOrderId}/actions/submit_completion`, {
        headers: contractorB,
        body: { evidenceId: uploaded.body.id },
      });
      expect(submitted.status).toBe(200);

      const inspection = await call(target.app, 'POST', `/v1/work-orders/${workOrderId}/inspections`, {
        headers: inspector,
        body: { kind: 'COMPLETION', decision: 'APPROVED', evidencePackageId: uploaded.body.id },
      });
      expect(inspection.status).toBe(201);

      const accepted = await call(target.app, 'POST', `/v1/work-orders/${workOrderId}/actions/accept_completion`, {
        headers: inspector,
        body: { inspectionId: inspection.body.id },
      });
      expect(accepted.status).toBe(200);
      expect(accepted.body.workOrder.status).toBe('DURABILITY_PENDING');
      expect(accepted.body.payments).toHaveLength(0);
      const afterAccept = await target.deps.repo.getEscrow(workOrderId);
      expect(afterAccept?.completionPaidMicro).toBe('72000000');

      const durability = await call(target.app, 'POST', `/v1/work-orders/${workOrderId}/inspections`, {
        headers: inspector,
        body: { kind: 'DURABILITY', decision: 'APPROVED', evidencePackageId: uploaded.body.id },
      });
      expect(durability.status).toBe(201);
      const closedAfterRemediation = await call(
        target.app,
        'POST',
        `/v1/work-orders/${workOrderId}/actions/inspect_durability`,
        { headers: inspector, body: { passed: true, inspectionId: durability.body.id } },
      );
      expect(closedAfterRemediation.status).toBe(200);
      expect(closedAfterRemediation.body.workOrder.status).toBe('CLOSED');

      const finalEscrow = await target.deps.repo.getEscrow(workOrderId);
      expect(finalEscrow).toMatchObject({
        fundedMicro: '100000000',
        refundedMicro: '20000000',
        completionPaidMicro: '72000000',
        holdbackHeldMicro: '0',
        holdbackReleasedMicro: '8000000',
      });
      const warranties = await target.deps.repo.listWarrantyCases(workOrderId);
      expect(warranties[0]?.state).toBe('CLOSED');
      const payments = await target.deps.repo.listPayments(workOrderId);
      expect(payments.filter((p) => p.kind === 'COMPLETION')).toHaveLength(1);
      expect(payments.filter((p) => p.kind === 'HOLDBACK')).toHaveLength(1);
      expect(payments.filter((p) => p.kind === 'REFUND')).toHaveLength(1);
    } finally {
      await target.close();
    }
  });

  it('keeps PENDING and FAILED RPC results honest and never applies the transition', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);
      const approval = await target.deps.repo.getDaoApproval('dao-42');
      expect(approval).not.toBeNull();
      for (const [index, adapter] of [
        [3, new PendingChainAdapter()],
        [4, new FailingChainAdapter()],
      ] as const) {
        const workOrderId = `WO-BENCH-001-000${index}`;
        await target.deps.repo.createWorkOrder({
          id: workOrderId,
          assetId: 'BENCH-001',
          reportClusterId: 'CL-0001',
          scopeHash: 'c'.repeat(64),
          daoApprovalId: 'dao-42',
          policyHash: approval!.policyHash,
          budgetMicro: '100000000',
          status: 'FUNDED',
          mode: 'REPLAY',
          sponsorId: FIXTURE_ACCOUNTS.sponsor,
          fundingToken: FIXTURE_ACCOUNTS.token,
          reopenCount: 0,
          createdAt: '2026-11-10T09:00:00.000Z',
          updatedAt: '2026-11-10T09:00:00.000Z',
          isDemo: true,
        });
        target.deps.commands = new ChainCommandService(adapter, target.deps.config, target.clock);
        const response = await call(target.app, 'POST', `/v1/work-orders/${workOrderId}/actions/open_bidding`, {
          headers: auth('STEWARD'),
          body: {},
        });
        expect(response.status).toBe(202);
        expect(response.body.applied).toBe(false);
        expect(response.body.command.state).toBe(adapter.kind === 'pending' ? 'PENDING' : 'FAILED');
        expect(response.body.command.realTransaction).toBe(false);
        expect((await target.deps.repo.getWorkOrder(workOrderId))?.status).toBe('FUNDED');
      }
    } finally {
      await target.close();
    }
  });

  it('rejects invalid transitions and early or late bid actions', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);
      const earlyAccept = await call(
        target.app,
        'POST',
        '/v1/work-orders/WO-BENCH-001-0001/actions/accept_completion',
        { headers: auth('INSPECTOR'), body: { inspectionId: 'INS-9999' } },
      );
      expect(earlyAccept.status).toBe(409);
      expect(earlyAccept.body.error.code).toBe('INVALID_STATE');

      const wrongAward = await call(
        target.app,
        'POST',
        '/v1/work-orders/WO-BENCH-001-0001/actions/award',
        { headers: auth('STEWARD'), body: { bidId: FIXTURE_IDS.bidA } },
      );
      expect(wrongAward.status).toBe(409);

      const earlyReveal = await call(
        target.app,
        'POST',
        '/v1/work-orders/WO-BENCH-001-0001/bids/reveal',
        {
          headers: auth('CONTRACTOR', FIXTURE_ACCOUNTS.contractorA),
          body: {},
        },
      );
      expect([403, 409, 400]).toContain(earlyReveal.status);
    } finally {
      await target.close();
    }
  });
});
