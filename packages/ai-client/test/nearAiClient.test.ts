import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { sha256Hex } from '../src/canonical.js';
import { loadNearAiConfig, publicNearAiConfig } from '../src/config.js';
import { NearAiClient } from '../src/nearAiClient.js';
import { ScopeSuggestionSchema } from '../src/scopeGenerator.js';

const SCOPE_FIXTURE = fileURLToPath(
  new URL('../../../fixtures/recorded-responses/near-ai/scope.json', import.meta.url),
);
const ATTACK_RESPONSE = fileURLToPath(
  new URL('../../../fixtures/attacks/prompt-injection/model-response-recipient-change.json', import.meta.url),
);

interface Fixture {
  response: unknown;
}

function fixtureBody(path: string): string {
  const fixture = JSON.parse(readFileSync(path, 'utf8')) as Fixture;
  return JSON.stringify(fixture.response);
}

function responseWithContent(content: string): string {
  return JSON.stringify({
    id: 'chatcmpl-test-0001',
    model: 'z-ai/glm-5.3-flash',
    choices: [{ message: { role: 'assistant', content } }],
  });
}

function clientReturning(body: string): NearAiClient {
  return new NearAiClient({
    config: {
      baseUrl: 'https://example.invalid/v1',
      apiKey: 'test-key-not-real-1234',
      model: 'z-ai/glm-5.3-flash',
      timeoutMs: 5_000,
    },
    fetchImpl: (async () =>
      new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch,
  });
}

describe('NEAR AI client', () => {
  it('loads environment config without exposing the key', () => {
    const config = loadNearAiConfig({
      NEAR_AI_BASE_URL: 'https://cloud-api.near.ai/v1/',
      NEAR_AI_API_KEY: 'test-key-not-real-1234',
      NEAR_AI_MODEL: 'z-ai/glm-5.3-flash',
    });
    expect(config.baseUrl).toBe('https://cloud-api.near.ai/v1');
    expect(config.model).toBe('z-ai/glm-5.3-flash');
    const safe = publicNearAiConfig(config);
    expect(safe.apiKeyConfigured).toBe(true);
    expect(JSON.stringify(safe)).not.toContain('test-key-not-real-1234');
  });

  it('rejects non-https base URLs and bad timeouts', () => {
    expect(() => loadNearAiConfig({ NEAR_AI_BASE_URL: 'http://example.com/v1' })).toThrow(/https/);
    expect(() => loadNearAiConfig({ NEAR_AI_TIMEOUT_MS: '10' })).toThrow(/timeout/i);
  });

  it('fails closed without an API key instead of attempting a network call', async () => {
    const client = new NearAiClient({
      config: { baseUrl: 'https://example.invalid/v1', model: 'z-ai/glm-5.3-flash', timeoutMs: 5_000 },
    });
    await expect(
      client.chatJson({
        system: 'system',
        user: 'user',
        schema: ScopeSuggestionSchema,
      }),
    ).rejects.toThrow(/NEAR_AI_API_KEY/);
  });

  it('validates strict JSON and returns request/response hashes', async () => {
    const body = fixtureBody(SCOPE_FIXTURE);
    const client = clientReturning(body);
    const record = await client.chatJson({
      system: 'Draft a scope.',
      user: 'Report: a cracked bench seat.',
      schema: ScopeSuggestionSchema,
    });

    expect(record.transport).toBe('live');
    expect(record.responseId).toBe('chatcmpl-recorded-scope-0001');
    expect(record.requestHash).toBe(sha256Hex(record.requestBodyText));
    expect(record.responseHash).toBe(sha256Hex(record.responseBodyText));
    expect(record.data.humanReviewRequired).toBe(true);
    expect(JSON.stringify(record)).not.toContain('test-key-not-real-1234');
  });

  it('rejects non-JSON content, wrong envelopes and extra output keys', async () => {
    await expect(
      clientReturning(responseWithContent('not json')).chatJson({
        system: 'system',
        user: 'user',
        schema: ScopeSuggestionSchema,
      }),
    ).rejects.toThrow(/strict JSON/);

    await expect(
      clientReturning(JSON.stringify({ nope: true })).chatJson({
        system: 'system',
        user: 'user',
        schema: ScopeSuggestionSchema,
      }),
    ).rejects.toThrow(/envelope/);

    const attack = JSON.parse(readFileSync(ATTACK_RESPONSE, 'utf8')) as {
      attemptedOutput: unknown;
    };
    await expect(
      clientReturning(responseWithContent(JSON.stringify(attack.attemptedOutput))).chatJson({
        system: 'system',
        user: 'user',
        schema: ScopeSuggestionSchema,
      }),
    ).rejects.toThrow();
  });

  it('never logs or returns the API key on an HTTP error', async () => {
    const client = new NearAiClient({
      config: {
        baseUrl: 'https://example.invalid/v1',
        apiKey: 'test-key-not-real-1234',
        model: 'z-ai/glm-5.3-flash',
        timeoutMs: 5_000,
      },
      fetchImpl: (async () =>
        new Response(JSON.stringify({ error: { message: 'invalid key' } }), {
          status: 401,
        })) as typeof fetch,
    });
    await expect(
      client.chatJson({ system: 'system', user: 'user', schema: ScopeSuggestionSchema }),
    ).rejects.not.toThrow(/test-key-not-real-1234/);
  });
});
