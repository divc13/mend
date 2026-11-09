import { describe, expect, it } from 'vitest';
import { sha256Hex } from '@mend/protocol';
import { loadConfig } from '../src/config.js';
import { artifactIntegrity } from '../src/routes/evidence.js';
import {
  auth,
  call,
  isoPlus,
  jpegWithExif,
  makeTestApp,
  seedDemo,
  strippedJpeg,
} from './helpers.js';

describe('MEND API — public surface and privacy', () => {
  it('serves health and explicit operating modes', async () => {
    const target = await makeTestApp();
    try {
      const health = await call(target.app, 'GET', '/health');
      expect(health.status).toBe(200);
      expect(health.body.status).toBe('ok');
      expect(health.body.mode).toBe('REPLAY');
      expect(health.body.chainAdapter.kind).toBe('replay');
      expect(health.body.intents.available).toBe(false);
      expect(JSON.stringify(health.body)).not.toContain('secret');

      const modes = await call(target.app, 'GET', '/v1/modes');
      expect(modes.status).toBe(200);
      expect(modes.body.current).toBe('REPLAY');
      expect(modes.body.modes.map((m: any) => m.mode)).toEqual(['LIVE_TESTNET', 'MAINNET', 'REPLAY']);
      expect(modes.body.modes.find((m: any) => m.mode === 'MAINNET').realFunds).toBe(true);
      expect(modes.body.disclaimer).toContain('REPLAY');
    } finally {
      await target.close();
    }
  });

  it('resets only demo data and produces an identical public state every time', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);
      await target.deps.repo.createAsset({
        id: 'RACK-999',
        publicDescription: 'Non-demo asset that must survive reset',
        assetType: 'other',
        publicLocation: { label: 'Elsewhere', coarseLat: 1, coarseLng: 2 },
        createdAt: '2026-01-01T00:00:00.000Z',
        isDemo: false,
      });
      const first = await call(target.app, 'POST', '/v1/demo/reset', {
        headers: auth('ADMIN'),
        body: { scenario: 'successfulRepair' },
      });
      expect(first.status).toBe(200);
      expect(first.body.reset).toBe(true);
      expect(first.body.fingerprint).toMatch(/^[a-f0-9]{64}$/);

      const second = await call(target.app, 'POST', '/v1/demo/reset', {
        headers: auth('ADMIN'),
        body: { scenario: 'successfulRepair' },
      });
      expect(second.status).toBe(200);
      expect(second.body.fingerprint).toBe(first.body.fingerprint);
      expect(await target.deps.repo.getAsset('RACK-999')).not.toBeNull();
      expect(await target.deps.repo.getAsset('BENCH-001')).not.toBeNull();
      expect(await target.deps.repo.getWorkOrder('WO-BENCH-001-0001')).not.toBeNull();

      const scenario = await call(target.app, 'POST', '/v1/demo/reset', {
        headers: auth('ADMIN'),
        body: { scenario: 'failedDurability' },
      });
      expect(scenario.status).toBe(200);
      const workOrder = await target.deps.repo.getWorkOrder('WO-BENCH-001-0001');
      expect(workOrder?.status).toBe('WARRANTY_REOPENED');
      const warranty = await target.deps.repo.listWarrantyCases('WO-BENCH-001-0001');
      expect(warranty).toHaveLength(1);
      expect(warranty[0]?.state).toBe('OPEN');

      const unknown = await call(target.app, 'POST', '/v1/demo/reset', {
        headers: auth('ADMIN'),
        body: { scenario: 'not-a-scenario' },
      });
      expect(unknown.status).toBe(400);
      expect(unknown.body.error.code).toBe('VALIDATION_ERROR');

      const closedScenario = await call(target.app, 'POST', '/v1/demo/reset', {
        headers: auth('ADMIN'),
        body: { scenario: 'closed' },
      });
      expect(closedScenario.status).toBe(200);
      expect((await target.deps.repo.getWorkOrder('WO-BENCH-001-0001'))?.status).toBe('CLOSED');
      expect(await target.deps.repo.getEscrow('WO-BENCH-001-0001')).toMatchObject({
        completionPaidMicro: '72000000',
        holdbackHeldMicro: '0',
        holdbackReleasedMicro: '8000000',
      });
    } finally {
      await target.close();
    }
  });

  it('has no demo reset route in production', async () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      MEND_MODE: 'REPLAY',
      DEMO_RESET_ENABLED: 'true',
      EVIDENCE_URL_SECRET: 'production-test-secret',
      EVIDENCE_DIR: '/tmp/mend-unused-evidence',
    });
    const target = await makeTestApp({ config });
    try {
      const response = await call(target.app, 'POST', '/v1/demo/reset', {
        headers: auth('ADMIN'),
        body: { scenario: 'successfulRepair' },
      });
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    } finally {
      await target.close();
    }
  });

  it('accepts walletless reports, strips EXIF and never leaks private location', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);
      const jpeg = jpegWithExif();
      const created = await call(target.app, 'POST', '/v1/reports', {
        body: {
          assetId: 'BENCH-001',
          description: 'New crack on the bench seat',
          publicLocation: { label: 'Riverside Park', coarseLat: 52.52, coarseLng: 13.405 },
          preciseLocation: { lat: 52.520007, lng: 13.405009, accuracyM: 4 },
          mediaBase64: jpeg.toString('base64'),
          mediaContentType: 'image/jpeg',
          perceptualHash: 'abc12345',
        },
      });
      expect(created.status).toBe(201);
      expect(created.body.id).toBe('R-003');
      expect(created.body.exifStripped).toBe(true);
      expect(created.body.redactedMediaHash).toBe(sha256Hex(strippedJpeg()));
      expect(created.body.reporterCaseLink).toMatch(/^case_/);
      expect(JSON.stringify(created.body)).not.toContain('52.520007');
      expect(JSON.stringify(created.body)).not.toContain('privateMediaKey');
      const caseLink = created.body.reporterCaseLink;

      const noLink = await call(target.app, 'GET', '/v1/reports/R-003');
      expect(noLink.status).toBe(401);
      expect(noLink.body.error.code).toBe('UNAUTHORIZED');

      const wrongLink = await call(target.app, 'GET', '/v1/reports/R-003', {
        headers: { 'x-mend-case-link': 'case_wrongwrongwrongwrong' },
      });
      expect(wrongLink.status).toBe(404);

      const caseView = await call(target.app, 'GET', '/v1/reports/R-003', {
        headers: { 'x-mend-case-link': caseLink },
      });
      expect(caseView.status).toBe(200);
      expect(caseView.body.report.reporterCaseLink).toBe(caseLink);
      expect(caseView.body.duplicateStatus).toBe('SUBMITTED');
      expect(JSON.stringify(caseView.body)).not.toContain('52.520007');

      const reporterTriesLocation = await call(target.app, 'GET', '/v1/reports/R-003/private-location', {
        headers: auth('REPORTER'),
      });
      expect(reporterTriesLocation.status).toBe(403);
      expect(reporterTriesLocation.body.error.code).toBe('FORBIDDEN_ROLE');

      const stewardLocation = await call(target.app, 'GET', '/v1/reports/R-003/private-location', {
        headers: auth('STEWARD'),
      });
      expect(stewardLocation.status).toBe(200);
      expect(stewardLocation.body.preciseLocation.lat).toBeCloseTo(52.520007);
      expect(stewardLocation.headers['cache-control']).toBe('no-store');

      const listAsReporter = await call(target.app, 'GET', '/v1/reports', { headers: auth('REPORTER') });
      expect(listAsReporter.status).toBe(403);
      const listAsSteward = await call(target.app, 'GET', '/v1/reports', { headers: auth('STEWARD') });
      expect(listAsSteward.status).toBe(200);
      expect(Array.isArray(listAsSteward.body)).toBe(true);
    } finally {
      await target.close();
    }
  });

  it('serves private report media only through a signed, time-limited link', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);
      const created = await call(target.app, 'POST', '/v1/reports', {
        body: {
          assetId: 'BENCH-001',
          description: 'Media privacy check',
          publicLocation: { label: 'Riverside Park', coarseLat: 52.52, coarseLng: 13.405 },
          mediaBase64: jpegWithExif().toString('base64'),
          mediaContentType: 'image/jpeg',
        },
      });
      const caseLink = created.body.reporterCaseLink;
      const access = await call(target.app, 'GET', '/v1/reports/R-003/media/access', {
        headers: { 'x-mend-case-link': caseLink },
      });
      expect(access.status).toBe(200);
      expect(access.body.url).toContain('/v1/reports/R-003/media/download');
      expect(access.headers['cache-control']).toBe('no-store');

      const downloadPath = new URL(access.body.url).pathname + new URL(access.body.url).search;
      const downloaded = await target.app.inject({ method: 'GET', url: downloadPath });
      expect(downloaded.statusCode).toBe(200);
      expect(Buffer.from(downloaded.rawPayload).equals(strippedJpeg())).toBe(true);
      expect(downloaded.headers['content-type']).toContain('image/jpeg');

      const tampered = await target.app.inject({
        method: 'GET',
        url: downloadPath.replace(/token=[^&]+/, 'token=tampered'),
      });
      expect(tampered.statusCode).toBe(401);

      target.clock.advance(301_000);
      const expired = await target.app.inject({ method: 'GET', url: downloadPath });
      expect(expired.statusCode).toBe(401);
      expect(JSON.parse(expired.body).error.code).toBe('UNAUTHORIZED');
    } finally {
      await target.close();
    }
  });

  it('labels unavailable AI triage honestly and only shows deterministic duplicates', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);
      const response = await call(target.app, 'POST', '/v1/reports/R-001/triage', {
        headers: auth('STEWARD'),
      });
      expect(response.status).toBe(201);
      expect(response.body.available).toBe(false);
      expect(response.body.verified).toBe(false);
      expect(response.body.label).toContain('UNAVAILABLE');
      expect(response.body.suggestion.unavailableReason).toContain('NEAR_AI_API_KEY');
      expect(response.body.suggestion.duplicateCandidates.map((c: any) => c.reportId)).toContain('R-002');

      const read = await call(target.app, 'GET', '/v1/reports/R-001/triage', { headers: auth('STEWARD') });
      expect(read.status).toBe(200);
      expect(read.body.suggestion.available).toBe(false);
    } finally {
      await target.close();
    }
  });

  it('exposes a non-transferable passport with maintenance history', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);
      const passport = await call(target.app, 'GET', '/v1/assets/BENCH-001/passport');
      expect(passport.status).toBe(200);
      expect(passport.body.nonTransferable).toBe(true);
      expect(passport.body.transferDisabled).toBe(true);
      expect(passport.body.legalOwnership).toContain('NONE');
      expect(passport.body.owner).toBe('mend-dao.sputnikv2.testnet');
      expect(passport.body.workOrders).toHaveLength(1);
      expect(passport.body.repeatFailures).toBe(0);

      const transfer = await call(target.app, 'POST', '/v1/passport/BENCH-001/transfer', {
        headers: auth('STEWARD'),
      });
      expect(transfer.status).toBe(403);
      expect(transfer.body.error.code).toBe('TRANSFER_DISABLED');

      const mint = await call(target.app, 'POST', '/v1/assets/RACK-002/passport/mint', {
        headers: auth('STEWARD'),
      });
      expect(mint.status).toBe(200);
      expect(mint.body.applied).toBe(true);
      expect(mint.body.command.realTransaction).toBe(false);
      expect(mint.body.label).toBe('REPLAY / SIMULATION');
      const byToken = await call(target.app, 'GET', '/v1/passport/RACK-002');
      expect(byToken.status).toBe(200);
      expect(byToken.body.minted).toBe(true);

      const history = await call(target.app, 'GET', '/v1/assets/BENCH-001/history');
      expect(history.status).toBe(200);
      expect(history.body.timeline).toHaveLength(1);
      expect(history.body.audit.length).toBeGreaterThan(0);
      expect(JSON.stringify(history.body)).not.toContain('52.520001');
    } finally {
      await target.close();
    }
  });

  it('reports metrics and honest adapter capabilities', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);
      const metrics = await call(target.app, 'GET', '/v1/metrics');
      expect(metrics.status).toBe(200);
      expect(metrics.body.mode).toBe('REPLAY');
      expect(metrics.body.assets).toBe(2);
      expect(metrics.body.workOrders).toBe(1);
      expect(metrics.body.money.fundedMicro).toBe('100000000');
      expect(metrics.body.money.refundedMicro).toBe('20000000');
      expect(metrics.body.verification.outlayerExecutionAvailable).toBe(false);
      expect(metrics.body.adapters.intents.available).toBe(false);
      expect(metrics.body.adapters.triage.available).toBe(false);

      const capabilities = await call(target.app, 'GET', '/v1/intents/capabilities');
      expect(capabilities.status).toBe(200);
      expect(capabilities.body.mainnetOnly).toBe(true);
      expect(capabilities.body.available).toBe(false);
      expect(capabilities.body.disclaimer).toContain('mainnet');

      const quote = await call(target.app, 'POST', '/v1/intents/quote', {
        headers: auth('SPONSOR'),
        body: {
          dry: true,
          srcChain: 'ethereum',
          srcAsset: 'USDC',
          dstAsset: 'USDC',
          amountIn: '1000000',
          recipient: 'sponsor.mend.testnet',
        },
      });
      expect(quote.status).toBe(503);
      expect(quote.body.error.code).toBe('UPSTREAM_UNAVAILABLE');
      expect(quote.body.error.details.available).toBe(false);
      expect(quote.body.error.details.mainnetOnly).toBe(true);
    } finally {
      await target.close();
    }
  });

  it('re-hashes verification artifacts and rejects modified ones', async () => {
    const target = await makeTestApp();
    try {
      const subjectHash = sha256Hex('subject');
      const artifact = { statement: 'model attested', model: 'test-model' };
      const recorded = await call(target.app, 'POST', '/v1/verification', {
        headers: auth('STEWARD'),
        body: { kind: 'NEAR_AI', subjectHash, artifact },
      });
      expect(recorded.status).toBe(201);
      expect(recorded.body.verified).toBe(false);
      const listed = await call(target.app, 'GET', `/v1/verification/${subjectHash}`);
      expect(listed.status).toBe(200);
      expect(listed.body.artifacts).toHaveLength(1);
      expect(listed.body.artifacts[0].verified).toBe(false);
      expect(listed.body.artifacts[0].artifactHash).toBe(sha256Hex(
        '{"model":"test-model","statement":"model attested"}',
      ));

      const tampered = {
        ...(await target.deps.repo.getAttestation(recorded.body.id))!,
        artifact: { ...artifact, statement: 'modified after signing' },
      };
      expect(artifactIntegrity(tampered)).toBe(false);
    } finally {
      await target.close();
    }
  });

  it('returns the protocol error shape for unknown routes and invalid input', async () => {
    const target = await makeTestApp();
    try {
      const missing = await call(target.app, 'GET', '/v1/nope');
      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('NOT_FOUND');
      expect(typeof missing.body.error.message).toBe('string');

      const invalid = await call(target.app, 'POST', '/v1/assets', {
        headers: auth('STEWARD'),
        body: { id: 'not-an-id' },
      });
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(invalid.body.error.details.issues)).toBe(true);
    } finally {
      await target.close();
    }
  });
});
