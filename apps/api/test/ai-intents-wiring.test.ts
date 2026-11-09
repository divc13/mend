import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '@mend/protocol';
import type { ChatJsonOptions, ChatJsonRecord, NearAiSignature } from '@mend/ai-client/server';
import type { QuoteResult, StatusResult } from '@mend/intents-client';
import { buildApp } from '../src/app.js';
import { loadConfig, type AppConfig } from '../src/config.js';
import {
  NearAiTriageAdapter,
  type TriageAdapter,
} from '../src/services/triage.js';
import {
  OneClickIntentsAdapter,
  type IntentsSdkClient,
} from '../src/services/intents.js';
import { auth, call, makeTestApp, seedDemo, type TestApp } from './helpers.js';

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

async function testConfig(overrides: NodeJS.ProcessEnv = {}): Promise<AppConfig> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mend-api-wiring-test-'));
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
    ...overrides,
  });
}

function chatRecord<T>(data: unknown, requestBodyText: string): ChatJsonRecord<T> {
  const responseBodyText = JSON.stringify(data);
  return {
    data: data as T,
    model: 'mock-near-ai-model',
    responseId: 'chat-mock-1',
    requestBodyText,
    responseBodyText,
    requestHash: sha256Hex(requestBodyText),
    responseHash: sha256Hex(responseBodyText),
    transport: 'recorded',
    usage: { prompt_tokens: 10, completion_tokens: 20 },
  };
}

const validClassification = {
  confidenceBps: 8_400,
  rationale: 'Cracked seat plank with a loose armrest; routine bench repair.',
  scopeSummary: 'Replace the cracked seat plank and reseat the loose armrest.',
  duplicateReportIds: ['R-002', 'R-999'],
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

function mockAiClient(options: {
  classification?: unknown;
  scope?: unknown | null;
  signature?: NearAiSignature;
} = {}) {
  const classification = options.classification ?? validClassification;
  const scope = options.scope === undefined ? validScope : options.scope;
  return {
    async chatJson<T>(request: ChatJsonOptions<T>): Promise<ChatJsonRecord<T>> {
      const data = request.system.includes('repair scope') ? (scope ?? validScope) : classification;
      return chatRecord<T>(data, `mock-request:${request.system.slice(0, 32)}`);
    },
    ...(options.signature
      ? { fetchSignature: async () => options.signature as NearAiSignature }
      : {}),
  };
}

function dryQuoteResult(dry = true): QuoteResult {
  const quoteRequest = {
    dry,
    swapType: 'EXACT_INPUT' as const,
    slippageTolerance: 50,
    originAsset: 'nep141:usdc.example',
    depositType: 'ORIGIN_CHAIN' as const,
    destinationAsset: 'nep141:usdc.near',
    amount: '1000000',
    refundTo: '0x0000000000000000000000000000000000000001',
    refundType: 'ORIGIN_CHAIN' as const,
    recipient: 'sponsor.mend.testnet',
    recipientType: 'DESTINATION_CHAIN' as const,
    deadline: '2026-11-10T09:30:00.000Z',
  };
  const quote = {
    amountIn: '1000000',
    amountInFormatted: '1.0',
    amountInUsd: '1.00',
    minAmountIn: '1000000',
    amountOut: '995000',
    amountOutFormatted: '0.995',
    amountOutUsd: '0.995',
    minAmountOut: '990000',
    timeEstimate: 30,
    withdrawFee: '0',
    ...(dry ? {} : { depositAddress: 'near-deposit-address', deadline: '2026-11-10T09:30:00.000Z' }),
  };
  const response = {
    correlationId: 'corr-mock-1',
    timestamp: '2026-11-10T09:00:00.000Z',
    signature: 'ed25519:mock-signature',
    quoteRequest,
    quote,
  };
  return { response, raw: { mock: true }, verified: true } as unknown as QuoteResult;
}

function mockIntentsClient(dry = true) {
  const getDryQuote = vi.fn(async () => dryQuoteResult(dry));
  const createDepositQuote = vi.fn(async () => dryQuoteResult(false));
  const getStatus = vi.fn(async (): Promise<StatusResult> => {
    throw new Error('getStatus must not be called in this test');
  });
  return {
    client: { getDryQuote, createDepositQuote, getStatus } as unknown as IntentsSdkClient,
    getDryQuote,
    createDepositQuote,
    getStatus,
  };
}

async function close(target: TestApp): Promise<void> {
  await target.close();
}

describe('MEND API — merged AI and Intents wiring', () => {
  it('without a key reports AI unavailable, keeps deterministic duplicates, and never invents confidence', async () => {
    const target = await makeTestApp();
    try {
      await seedDemo(target);
      const health = await call(target.app, 'GET', '/health');
      expect(health.status).toBe(200);
      expect(health.body.triage.available).toBe(false);
      expect(health.body.triage.reason).toContain('NEAR_AI_API_KEY');
      expect(JSON.stringify(health.body.intents)).not.toContain('R0-C');
      expect(health.body.intents.reason).toContain('INTENTS_ENABLED');

      const response = await call(target.app, 'POST', '/v1/reports/R-001/triage', {
        headers: auth('STEWARD'),
      });
      expect(response.status).toBe(201);
      expect(response.body.available).toBe(false);
      expect(response.body.verified).toBe(false);
      expect(response.body.label).toContain('UNAVAILABLE');
      expect(response.body.suggestion.unavailableReason).toContain('NEAR_AI_API_KEY');
      expect('confidenceBps' in response.body.suggestion).toBe(false);
      expect(response.body.suggestion.duplicateCandidates.map((candidate: any) => candidate.reportId)).toContain('R-002');
      expect(response.body.verification.status).toBe('UNAVAILABLE');
      expect(response.body.verification.requestHash).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain('confidenceBps');
    } finally {
      await close(target);
    }
  });

  it('mocked AI client returns a strict-schema suggestion, hashes and an UNAVAILABLE verification artifact', async () => {
    const config = await testConfig({ NEAR_AI_API_KEY: 'test-only-ai-key' });
    const triage = new NearAiTriageAdapter(config.triage, { client: mockAiClient() });
    const target = await makeTestApp({ config, triage });
    try {
      await seedDemo(target);
      const response = await call(target.app, 'POST', '/v1/reports/R-001/triage', {
        headers: auth('STEWARD'),
      });
      expect(response.status).toBe(201);
      expect(response.body.available).toBe(true);
      expect(response.body.verified).toBe(false);
      expect(response.body.label).toBe('UNVERIFIED_INFERENCE');
      expect(response.body.suggestion.confidenceBps).toBe(8_400);
      expect(response.body.suggestion.rationale).toContain('loose armrest');
      expect(response.body.suggestion.scope).toContain('replacement plank');
      expect(response.body.suggestion.duplicateCandidates.map((candidate: any) => candidate.reportId)).toContain('R-002');
      expect(response.body.verification.status).toBe('UNAVAILABLE');
      expect(response.body.verification.method).toBe('NONE');
      expect(response.body.verification.requestHash).toMatch(/^[a-f0-9]{64}$/);
      expect(response.body.verification.responseHash).toMatch(/^[a-f0-9]{64}$/);

      expect(response.body.suggestion.attestationId).toMatch(/^ATT-/);
      const attestation = await target.deps.repo.getAttestation(response.body.suggestion.attestationId);
      expect(attestation?.verified).toBe(false);
      expect(attestation?.artifact.requestHash).toBe(response.body.verification.requestHash);
      expect((attestation?.artifact.verification as any).status).toBe('UNAVAILABLE');
      expect(attestation?.artifact.scopeSuggestionHash).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      await close(target);
    }
  });

  it('rejects AI output that fails the strict schema instead of inventing a confidence score', async () => {
    const config = await testConfig({ NEAR_AI_API_KEY: 'test-only-ai-key' });
    const triage = new NearAiTriageAdapter(config.triage, {
      client: mockAiClient({
        classification: { ...validClassification, inventedConfidence: 9_999 },
      }),
    });
    const target = await makeTestApp({ config, triage });
    try {
      await seedDemo(target);
      const response = await call(target.app, 'POST', '/v1/reports/R-001/triage', {
        headers: auth('STEWARD'),
      });
      expect(response.status).toBe(201);
      expect(response.body.available).toBe(false);
      expect(response.body.verified).toBe(false);
      expect('confidenceBps' in response.body.suggestion).toBe(false);
      expect(response.body.suggestion.unavailableReason).toContain('strict schema');
      expect(response.body.verification.status).toBe('UNAVAILABLE');
    } finally {
      await close(target);
    }
  });

  it('serves a dry Intents quote through the merged client as a labelled preview, never a payment', async () => {
    const config = await testConfig({ INTENTS_ENABLED: 'true' });
    const { client, getDryQuote, createDepositQuote } = mockIntentsClient(true);
    const intents = new OneClickIntentsAdapter(config.intents, {
      client,
      now: () => new Date('2026-11-10T09:00:00.000Z'),
    });
    const target = await buildApp({ config, intents });
    try {
      const capabilities = await call(target.app, 'GET', '/v1/intents/capabilities');
      expect(capabilities.status).toBe(200);
      expect(capabilities.body.available).toBe(true);
      expect(capabilities.body.dryQuotesEnabled).toBe(true);
      expect(capabilities.body.liveExecutionEnabled).toBe(false);
      expect(capabilities.body.liveRequiresHumanConfirmation).toBe(true);
      expect(capabilities.body.signingEnabled).toBe(false);
      expect(capabilities.body.mainnetOnly).toBe(true);
      expect(capabilities.body.mainnetLabel).toContain('MAINNET ONLY');
      expect(capabilities.body.statuses).toContain('PENDING_DEPOSIT');

      const quote = await call(target.app, 'POST', '/v1/intents/quote', {
        headers: auth('SPONSOR'),
        body: {
          dry: true,
          srcChain: 'ethereum',
          srcAsset: 'nep141:usdc.example',
          dstAsset: 'nep141:usdc.near',
          amountIn: '1000000',
          recipient: 'sponsor.mend.testnet',
          refundTo: '0x0000000000000000000000000000000000000001',
        },
      });
      expect(quote.status).toBe(201);
      expect(getDryQuote).toHaveBeenCalledTimes(1);
      expect(createDepositQuote).not.toHaveBeenCalled();
      expect(quote.body.dry).toBe(true);
      expect(quote.body.quoteKind).toBe('DRY_PREVIEW');
      expect(quote.body.isPayment).toBe(false);
      expect(quote.body.canBePresentedAsPayment).toBe(false);
      expect(quote.body.mainnetOnly).toBe(true);
      expect(quote.body.mainnetLabel).toContain('MAINNET ONLY');
      expect(quote.body.label).toContain('Preview only');
      expect(quote.body.preview.quoteKind).toBe('DRY_PREVIEW');
      expect(quote.body.preview.deposit).toBeNull();
      expect(quote.body.preview.isPayment).toBe(false);
      expect(quote.body.preview.canBePresentedAsPayment).toBe(false);
      expect(quote.body.signatureVerified).toBe(true);
      expect(quote.body.depositAddress).toBeUndefined();
      expect(JSON.stringify(quote.body)).not.toContain('depositAddress');
    } finally {
      await target.app.close();
    }
  });

  it('maps Intents status through the merged client and never treats SUCCESS as funded', async () => {
    const config = await testConfig({ INTENTS_ENABLED: 'true' });
    const getStatus = vi.fn(async (): Promise<StatusResult> => ({
      response: {
        status: 'SUCCESS',
        updatedAt: '2026-11-10T09:10:00.000Z',
        correlationId: 'corr-mock-1',
        swapDetails: {
          depositedAmount: '1000000',
          depositedAmountFormatted: '1.0',
          depositedAmountUsd: '1.00',
          intentHashes: [],
          nearTxHashes: [],
          amountIn: '1000000',
          amountInFormatted: '1.0',
          amountInUsd: '1.00',
          amountOut: '995000',
          amountOutFormatted: '0.995',
          amountOutUsd: '0.995',
          slippage: null,
          refundReason: null,
          originChainTxHashes: [],
          destinationChainTxHashes: [
            { hash: 'dest-tx-hash', explorerUrl: 'https://explorer.example/tx/dest-tx-hash' },
          ],
        },
      },
      raw: { mock: true },
      verified: true,
    }) as unknown as StatusResult);
    const intents = new OneClickIntentsAdapter(config.intents, {
      client: {
        getDryQuote: vi.fn(async () => dryQuoteResult(true)),
        createDepositQuote: vi.fn(async () => dryQuoteResult(false)),
        getStatus,
      },
      now: () => new Date('2026-11-10T09:11:00.000Z'),
    });

    const status = await intents.status({
      quoteId: 'IQ-0001',
      depositAddress: 'near-deposit-address',
      deadline: '2026-11-10T09:30:00.000Z',
    });
    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(status.status).toBe('SUCCESS');
    expect(status.flowState).toBe('SETTLING');
    expect(status.verified).toBe(true);
    expect(status.rawStatus).toBe('SUCCESS');
    expect(status.destinationTxHash).toBe('dest-tx-hash');
    expect(status.explorerUrl).toContain('dest-tx-hash');
  });

  it('refuses a live Intents request without explicit human confirmation before any client call', async () => {
    const config = await testConfig({ INTENTS_ENABLED: 'true', INTENTS_ALLOW_LIVE: 'true' });
    const { client, createDepositQuote } = mockIntentsClient(false);
    const intents = new OneClickIntentsAdapter(config.intents, { client });
    const target = await buildApp({ config, intents });
    try {
      const quote = await call(target.app, 'POST', '/v1/intents/quote', {
        headers: auth('SPONSOR'),
        body: {
          dry: false,
          srcChain: 'ethereum',
          srcAsset: 'nep141:usdc.example',
          dstAsset: 'nep141:usdc.near',
          amountIn: '1000000',
          recipient: 'sponsor.mend.testnet',
          refundTo: '0x0000000000000000000000000000000000000001',
        },
      });
      expect(quote.status).toBe(409);
      expect(quote.body.error.code).toBe('INVALID_STATE');
      expect(quote.body.error.details.humanConfirmationRequired).toBe(true);
      expect(quote.body.error.details.mainnetOnly).toBe(true);
      expect(createDepositQuote).not.toHaveBeenCalled();
      expect(JSON.stringify(quote.body)).not.toContain('depositAddress');
    } finally {
      await target.app.close();
    }
  });

  it('never serializes the AI or Intents API key in health, metrics, capabilities, triage or quote responses', async () => {
    const aiKey = 'super-secret-ai-key-123456';
    const intentsKey = 'super-secret-intents-jwt-987654';
    const config = await testConfig({
      NEAR_AI_API_KEY: aiKey,
      INTENTS_ENABLED: 'true',
      INTENTS_API_KEY: intentsKey,
    });
    const triage: TriageAdapter = new NearAiTriageAdapter(config.triage, { client: mockAiClient() });
    const { client } = mockIntentsClient(true);
    const intents = new OneClickIntentsAdapter(config.intents, { client });
    const target = await makeTestApp({ config, triage, intents });
    try {
      await seedDemo(target);
      const health = await call(target.app, 'GET', '/health');
      expect(health.body.triage.apiKeyConfigured).toBe(true);
      const metrics = await call(target.app, 'GET', '/v1/metrics');
      const capabilities = await call(target.app, 'GET', '/v1/intents/capabilities');
      const triageResponse = await call(target.app, 'POST', '/v1/reports/R-001/triage', {
        headers: auth('STEWARD'),
      });
      const quoteResponse = await call(target.app, 'POST', '/v1/intents/quote', {
        headers: auth('SPONSOR'),
        body: {
          dry: true,
          srcChain: 'ethereum',
          srcAsset: 'nep141:usdc.example',
          dstAsset: 'nep141:usdc.near',
          amountIn: '1000000',
          recipient: 'sponsor.mend.testnet',
          refundTo: '0x0000000000000000000000000000000000000001',
        },
      });

      const serialized = JSON.stringify({
        health: health.body,
        metrics: metrics.body,
        capabilities: capabilities.body,
        triage: triageResponse.body,
        quote: quoteResponse.body,
      });
      expect(serialized).not.toContain(aiKey);
      expect(serialized).not.toContain(intentsKey);
      expect(serialized).not.toContain('Authorization');
      expect(serialized).not.toContain('x-api-key');
    } finally {
      await close(target);
    }
  });
});
