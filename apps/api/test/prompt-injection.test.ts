import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { sha256Hex } from '@mend/protocol';
import type { ChatJsonOptions, ChatJsonRecord } from '@mend/ai-client/server';
import { loadConfig } from '../src/config.js';
import { NearAiTriageAdapter, triageOutputSchema } from '../src/services/triage.js';
import { auth, call, makeTestApp, seedDemo, type TestApp } from './helpers.js';

const ATTACK_DESCRIPTION = readFileSync(
  new URL('../../../fixtures/attacks/prompt-injection/report.txt', import.meta.url),
  'utf8',
);

const CLEAN_DESCRIPTION = 'Cracked bench seat plank near the east gate; the armrest is loose.';

const validClassification = {
  confidenceBps: 8_100,
  rationale: 'Cracked seat plank with a loose armrest; routine bench repair.',
  scopeSummary: 'Replace the cracked seat plank and reseat the loose armrest.',
  duplicateReportIds: [],
};

const validScope = {
  summary: 'Replace the cracked bench seat plank and tighten the loose armrest.',
  tasks: ['Remove the damaged plank', 'Fit and fasten a replacement plank'],
  safetyExclusions: ['Do not perform electrical or gas work'],
  requiredEvidence: ['Photo of the repaired seat', 'Material receipt'],
  budgetRecommendationMicro: '45000000',
  assumptions: ['Replacement plank is available locally'],
  humanReviewRequired: true,
};

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

function chatRecord<T>(data: unknown): ChatJsonRecord<T> {
  const requestBodyText = 'mock-request';
  const responseBodyText = JSON.stringify(data);
  return {
    data: data as T,
    model: 'mock-near-ai-model',
    responseId: `chat-${Math.random().toString(36).slice(2)}`,
    requestBodyText,
    responseBodyText,
    requestHash: sha256Hex(requestBodyText),
    responseHash: sha256Hex(responseBodyText),
    transport: 'recorded',
    usage: { prompt_tokens: 10, completion_tokens: 20 },
  };
}

function mockAiClient() {
  return {
    async chatJson<T>(request: ChatJsonOptions<T>): Promise<ChatJsonRecord<T>> {
      return chatRecord<T>(request.system.includes('repair scope') ? validScope : validClassification);
    },
  };
}

async function testConfig() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mend-api-injection-test-'));
  tempDirs.push(dir);
  return loadConfig({
    NODE_ENV: 'test',
    MEND_MODE: 'REPLAY',
    CHAIN_ADAPTER: 'replay',
    DEMO_RESET_ENABLED: 'true',
    DEMO_ADMIN_ACCOUNT: 'demo-admin.mend.testnet',
    EVIDENCE_DIR: dir,
    EVIDENCE_URL_SECRET: 'test-only-evidence-secret',
    PUBLIC_BASE_URL: 'http://127.0.0.1:4010',
    BID_COMMIT_WINDOW_SECONDS: '300',
    BID_REVEAL_WINDOW_SECONDS: '300',
    DEMO_DURABILITY_MINUTES: '2',
    NEAR_AI_API_KEY: 'test-key-not-real',
  });
}

async function createReport(target: TestApp, description: string): Promise<string> {
  const created = await call(target.app, 'POST', '/v1/reports', {
    body: {
      assetId: 'BENCH-001',
      description,
      publicLocation: { label: 'Riverside Park', coarseLat: 52.52, coarseLng: 13.405 },
    },
  });
  expect(created.status).toBe(201);
  return created.body.id as string;
}

describe('API triage — prompt injection is detected, logged and carries no authority', () => {
  it('logs prompt_injection_blocked and keeps malicious report text as untrusted data', async () => {
    const config = await testConfig();
    const triage = new NearAiTriageAdapter(config.triage, { client: mockAiClient() });
    const target = await makeTestApp({ config, triage });
    try {
      await seedDemo(target);
      const attackedReportId = await createReport(target, ATTACK_DESCRIPTION);
      const cleanReportId = await createReport(target, CLEAN_DESCRIPTION);

      const attacked = await call(target.app, 'POST', `/v1/reports/${attackedReportId}/triage`, {
        headers: auth('STEWARD'),
      });
      expect(attacked.status).toBe(201);
      expect(attacked.body.available).toBe(true);
      expect(attacked.body.suggestion.confidenceBps).toBe(8_100);
      expect(attacked.body.injectionScan.detected).toBe(true);
      expect(attacked.body.injectionScan.categories).toEqual(
        expect.arrayContaining(['ignore-instructions', 'recipient-change', 'role-change', 'acceptance-change']),
      );

      // The attack must be visible in the append-only security trail.
      const blocked = await target.deps.repo.listAudit({ name: 'prompt_injection_blocked' });
      expect(blocked).toHaveLength(1);
      expect(blocked[0]?.data).toEqual({
        reportId: attackedReportId,
        categories: expect.arrayContaining(['ignore-instructions', 'recipient-change', 'role-change']),
        action: 'treated-as-untrusted-data',
      });
      // The raw attack text must never be copied into the audit row.
      expect(JSON.stringify(blocked[0]?.data)).not.toMatch(/IGNORE PREVIOUS INSTRUCTIONS/i);

      // No attacker-controlled recipient, role or acceptance change leaks out.
      const serialized = JSON.stringify(attacked.body);
      expect(serialized).not.toContain('attacker.mend.testnet');
      expect(serialized).not.toMatch(/ADMIN role/i);
      const suggestion = attacked.body.suggestion as Record<string, unknown>;
      for (const forbidden of ['recipient', 'role', 'scopeHash', 'payoutRule', 'accepted', 'approved', 'certified']) {
        expect(suggestion).not.toHaveProperty(forbidden);
      }
      expect(attacked.body.suggestion.scopeSuggestion).toBeUndefined();
      expect(attacked.body.verified).toBe(false);

      // A clean report does not trigger the security event.
      const clean = await call(target.app, 'POST', `/v1/reports/${cleanReportId}/triage`, {
        headers: auth('STEWARD'),
      });
      expect(clean.status).toBe(201);
      expect(clean.body.injectionScan.detected).toBe(false);
      expect(await target.deps.repo.listAudit({ name: 'prompt_injection_blocked' })).toHaveLength(1);

      // The scope hash is produced by trusted scope logic and is identical for
      // the clean and the attacked report under the same model.
      const attackedArtifact = await target.deps.repo.getAttestation(
        attacked.body.suggestion.attestationId as string,
      );
      const cleanArtifact = await target.deps.repo.getAttestation(
        clean.body.suggestion.attestationId as string,
      );
      expect(attackedArtifact?.artifact.scopeSuggestionHash).toBe(
        cleanArtifact?.artifact.scopeSuggestionHash,
      );

      // The persisted model output still satisfies the strict classification schema.
      expect(() => triageOutputSchema.parse(attackedArtifact?.artifact.modelOutput)).not.toThrow();
    } finally {
      await target.close();
    }
  });

  it('reports the detection even when AI inference is unavailable', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);
      const reportId = await createReport(target, ATTACK_DESCRIPTION);
      const response = await call(target.app, 'POST', `/v1/reports/${reportId}/triage`, {
        headers: auth('STEWARD'),
      });
      expect(response.status).toBe(201);
      expect(response.body.available).toBe(false);
      expect(response.body.injectionScan.detected).toBe(true);
      expect(response.body.injectionScan.categories.length).toBeGreaterThan(0);
      const blocked = await target.deps.repo.listAudit({ name: 'prompt_injection_blocked' });
      expect(blocked).toHaveLength(1);
      expect(blocked[0]?.data.action).toBe('treated-as-untrusted-data');
    } finally {
      await target.close();
    }
  });
});
