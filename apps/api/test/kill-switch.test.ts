import { describe, expect, it } from 'vitest';
import { HUB_METHODS } from '@mend/protocol';
import { loadConfig } from '../src/config.js';
import { ChainCommandService, UnavailableChainAdapter } from '../src/services/chain.js';
import { auth, call, makeTestApp, seedDemo } from './helpers.js';

const ENABLE_REASON = 'Operator detected anomalous agent activity';
const DISABLE_REASON = 'Incident reviewed and cleared';

function assetBody(id: string) {
  return {
    id,
    publicDescription: 'Kill-switch test bench',
    assetType: 'bench' as const,
    publicLocation: { label: 'Kill-switch test park', coarseLat: 52.52, coarseLng: 13.405 },
  };
}

async function enable(target: Awaited<ReturnType<typeof makeTestApp>>, reason = ENABLE_REASON) {
  return call(target.app, 'POST', '/v1/admin/kill-switch', {
    headers: auth('ADMIN'),
    body: { enabled: true, reason },
  });
}

describe('MEND API — human kill switch', () => {
  it('refuses non-admin activation and non-staff reads', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);

      const wrongRole = await call(target.app, 'POST', '/v1/admin/kill-switch', {
        headers: auth('STEWARD'),
        body: { enabled: true, reason: ENABLE_REASON },
      });
      expect(wrongRole.status).toBe(403);
      expect(wrongRole.body.error.code).toBe('FORBIDDEN_ROLE');

      const anonymous = await call(target.app, 'POST', '/v1/admin/kill-switch', {
        body: { enabled: true, reason: ENABLE_REASON },
      });
      expect(anonymous.status).toBe(401);
      expect(anonymous.body.error.code).toBe('UNAUTHORIZED');

      const staffRead = await call(target.app, 'GET', '/v1/admin/kill-switch', {
        headers: auth('STEWARD'),
      });
      expect(staffRead.status).toBe(200);
      expect(staffRead.body.enabled).toBe(false);

      const contractorRead = await call(target.app, 'GET', '/v1/admin/kill-switch', {
        headers: auth('CONTRACTOR'),
      });
      expect(contractorRead.status).toBe(403);
      expect(contractorRead.body.error.code).toBe('FORBIDDEN_ROLE');
    } finally {
      await target.close();
    }
  });

  it('pauses every mutating /v1 route, keeps reads working, audits both transitions and restores writes', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);

      const enabled = await enable(target);
      expect(enabled.status).toBe(200);
      expect(enabled.body.enabled).toBe(true);
      expect(enabled.body.mutatingRoutesPaused).toBe(true);
      expect(enabled.body.chainCommand.action).toBe('pause');
      expect(enabled.body.chainCommand.method).toBe(HUB_METHODS.pause);
      expect(enabled.body.hubPause.state).toBe('SUCCESS');
      expect(enabled.body.hubPause.txHash).toMatch(/^replay:/);
      expect(enabled.body.hubPause.realTransaction).toBe(false);
      expect(enabled.body.hubPause.executed).toBe(false);
      expect(enabled.body.hubPause.note).toContain('no real hub transaction');

      const health = await call(target.app, 'GET', '/health');
      expect(health.status).toBe(200);
      expect(health.body.killSwitch.enabled).toBe(true);
      expect(health.body.killSwitch.reason).toBe(ENABLE_REASON);

      const reads = await call(target.app, 'GET', '/v1/assets');
      expect(reads.status).toBe(200);
      const readBids = await call(target.app, 'GET', '/v1/work-orders/WO-BENCH-001-0001/bids');
      expect(readBids.status).toBe(200);
      const statusRead = await call(target.app, 'GET', '/v1/admin/kill-switch', { headers: auth('ADMIN') });
      expect(statusRead.status).toBe(200);
      expect(statusRead.body.enabled).toBe(true);
      expect(statusRead.body.reason).toBe(ENABLE_REASON);

      const blocked = await call(target.app, 'POST', '/v1/assets', {
        headers: auth('STEWARD'),
        body: assetBody('PAUSE-001'),
      });
      expect(blocked.status).toBe(423);
      expect(blocked.body.error.code).toBe('CONTRACT_PAUSED');
      expect(blocked.body.error.message).toContain(ENABLE_REASON);
      expect(blocked.body.error.details.scope).toContain('mutating /v1');

      // Even a request without auth headers is stopped at the kill-switch gate.
      const blockedAnonymous = await call(target.app, 'POST', '/v1/assets', {
        body: assetBody('PAUSE-002'),
      });
      expect(blockedAnonymous.status).toBe(423);
      expect(blockedAnonymous.body.error.code).toBe('CONTRACT_PAUSED');

      const blockedWorkOrderAction = await call(
        target.app,
        'POST',
        '/v1/work-orders/WO-BENCH-001-0001/actions/open_bidding',
        { headers: auth('STEWARD'), body: {} },
      );
      expect(blockedWorkOrderAction.status).toBe(423);
      expect(blockedWorkOrderAction.body.error.code).toBe('CONTRACT_PAUSED');

      const enableAudit = await call(target.app, 'GET', '/v1/audit?name=kill_switch_enabled', {
        headers: auth('ADMIN'),
      });
      expect(enableAudit.status).toBe(200);
      expect(enableAudit.body.appendOnly).toBe(true);
      const enableEvent = enableAudit.body.events.at(-1);
      expect(enableEvent.name).toBe('kill_switch_enabled');
      expect(enableEvent.actor).toBe('demo-admin.mend.testnet');
      expect(enableEvent.data.reason).toBe(ENABLE_REASON);
      expect(enableEvent.data.chainAction).toBe('pause');
      expect(enableEvent.data.chainState).toBe('SUCCESS');
      expect(enableEvent.data.chainRealTransaction).toBe(false);
      expect(enableEvent.data.hubPauseExecuted).toBe(false);

      const disabled = await call(target.app, 'POST', '/v1/admin/kill-switch', {
        headers: auth('ADMIN'),
        body: { enabled: false, reason: DISABLE_REASON },
      });
      expect(disabled.status).toBe(200);
      expect(disabled.body.enabled).toBe(false);
      expect(disabled.body.mutatingRoutesPaused).toBe(false);
      expect(disabled.body.chainCommand.action).toBe('unpause');
      expect(disabled.body.chainCommand.method).toBe(HUB_METHODS.unpause);

      const restored = await call(target.app, 'POST', '/v1/assets', {
        headers: auth('STEWARD'),
        body: assetBody('PAUSE-003'),
      });
      expect(restored.status).toBe(201);
      expect(restored.body.id).toBe('PAUSE-003');

      const disableAudit = await call(target.app, 'GET', '/v1/audit?name=kill_switch_disabled', {
        headers: auth('ADMIN'),
      });
      expect(disableAudit.status).toBe(200);
      const disableEvent = disableAudit.body.events.at(-1);
      expect(disableEvent.name).toBe('kill_switch_disabled');
      expect(disableEvent.actor).toBe('demo-admin.mend.testnet');
      expect(disableEvent.data.reason).toBe(DISABLE_REASON);
      expect(disableEvent.data.chainAction).toBe('unpause');
      expect(disableEvent.data.previousEnabled).toBe(true);
    } finally {
      await target.close();
    }
  });

  it('records an honest chain intent when the adapter cannot broadcast', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      MEND_MODE: 'REPLAY',
      CHAIN_ADAPTER: 'replay',
      DEMO_RESET_ENABLED: 'true',
      DEMO_ADMIN_ACCOUNT: 'demo-admin.mend.testnet',
      EVIDENCE_URL_SECRET: 'test-only-evidence-secret',
      PUBLIC_BASE_URL: 'http://127.0.0.1:4010',
    });
    const clock = { now: () => new Date('2026-11-10T09:00:00.000Z') };
    const commands = new ChainCommandService(
      new UnavailableChainAdapter('No signer configured; hub pause remains an intent'),
      config,
      clock,
    );
    const target = await makeTestApp({ config, commands, clock });
    try {
      await seedDemo(target);
      const enabled = await enable(target);
      expect(enabled.status).toBe(200);
      expect(enabled.body.enabled).toBe(true);
      expect(enabled.body.chainCommand.state).toBe('INTENT');
      expect(enabled.body.chainCommand.txHash).toBeUndefined();
      expect(enabled.body.chainCommand.realTransaction).toBe(false);
      expect(enabled.body.hubPause.adapterSucceeded).toBe(false);
      expect(enabled.body.hubPause.executed).toBe(false);
      expect(enabled.body.hubPause.note).toContain('not confirmed');

      const audit = await call(target.app, 'GET', '/v1/audit?name=kill_switch_enabled', {
        headers: auth('ADMIN'),
      });
      const event = audit.body.events.at(-1);
      expect(event.data.chainState).toBe('INTENT');
      expect(event.data.chainTxHash).toBeNull();
      expect(event.data.adapterSucceeded).toBe(false);
      expect(event.data.hubPauseExecuted).toBe(false);
    } finally {
      await target.close();
    }
  });

  it('restores the last human decision after a process restart', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);
      expect((await enable(target)).status).toBe(200);

      const revived = await makeTestApp({
        repo: target.deps.repo,
        config: target.deps.config,
        clock: target.clock,
        commands: target.deps.commands,
      });
      try {
        const statusRead = await call(revived.app, 'GET', '/v1/admin/kill-switch', {
          headers: auth('ADMIN'),
        });
        expect(statusRead.status).toBe(200);
        expect(statusRead.body.enabled).toBe(true);
        expect(statusRead.body.reason).toBe(ENABLE_REASON);

        const blocked = await call(revived.app, 'POST', '/v1/assets', {
          headers: auth('STEWARD'),
          body: assetBody('PAUSE-004'),
        });
        expect(blocked.status).toBe(423);
        expect(blocked.body.error.code).toBe('CONTRACT_PAUSED');
      } finally {
        await revived.app.close();
      }
    } finally {
      await target.close();
    }
  });
});
