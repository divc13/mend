import { describe, expect, it } from 'vitest';
import { OneClickClient } from '../src/client.js';
import {
  IntentsApiError,
  IntentsNetworkError,
  IntentsSchemaError,
  IntentsTimeoutError,
  InvalidQuoteRequestError,
  MainnetGuardError,
  NearRecipientCheckError,
  QuoteSignatureError,
} from '../src/errors.js';
import type { QuoteParams } from '../src/client.js';
import {
  BASE_USDC,
  LIVE_DEPOSIT_ADDRESS,
  NEAR_USDC,
  READINESS,
  createFetchMock,
  jsonResponse,
  loadFixture,
} from './helpers.js';

const PARAMS: QuoteParams = {
  originAsset: BASE_USDC,
  destinationAsset: NEAR_USDC,
  amount: '10000000',
  recipient: 'mend.near',
  refundTo: '0x1111111111111111111111111111111111111111',
  slippageTolerance: 100,
};

function headersOf(init: RequestInit): Record<string, string> {
  return init.headers as Record<string, string>;
}

describe('OneClickClient', () => {
  it('fetches and validates supported tokens with the required base URL and headers', async () => {
    const tokens = loadFixture('tokens.snapshot.json');
    const { fetchImpl, calls } = createFetchMock(() => jsonResponse(tokens));
    const client = new OneClickClient({ fetchImpl });

    const result = await client.getTokens();
    expect(result.tokens).toHaveLength(5);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://1click.chaindefuser.com/v0/tokens');
    expect(calls[0]?.init.method).toBe('GET');
    const headers = headersOf(calls[0]!.init);
    expect(headers['user-agent']).toContain('mend-intents-client');
    expect(headers['x-api-key']).toBeUndefined();
  });

  it('sends the partner key as X-API-Key server-side only', async () => {
    const tokens = loadFixture('tokens.snapshot.json');
    const { fetchImpl, calls } = createFetchMock(() => jsonResponse(tokens));
    const client = new OneClickClient({ fetchImpl, apiKey: 'test-partner-jwt-not-real' });

    await client.getTokens();
    expect(headersOf(calls[0]!.init)['x-api-key']).toBe('test-partner-jwt-not-real');
  });

  it('creates a dry quote, verifies the signature and never allocates a deposit address', async () => {
    const dry = loadFixture('quote.dry.base-usdc-near-usdc.json');
    const { fetchImpl, calls } = createFetchMock(() => jsonResponse(dry, 201));
    const client = new OneClickClient({ fetchImpl, now: () => new Date('2026-11-09T09:47:00.000Z') });

    const result = await client.getDryQuote(PARAMS);
    expect(result.verified).toBe(true);
    expect(result.response.quote.depositAddress).toBeUndefined();
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
    expect(body.dry).toBe(true);
    expect(body.swapType).toBe('EXACT_INPUT');
    expect(body.referral).toBe('mend');
    expect(body.amount).toBe('10000000');
    expect(String(body.deadline)).toBe('2026-11-09T10:17:00.000Z');
  });

  it('rejects a tampered quote response', async () => {
    const tampered = loadFixture('quote.dry.tampered-recipient.json');
    const { fetchImpl } = createFetchMock(() => jsonResponse(tampered, 201));
    const client = new OneClickClient({ fetchImpl });

    await expect(client.getDryQuote(PARAMS)).rejects.toBeInstanceOf(QuoteSignatureError);
  });

  it('rejects a dry quote that contains deposit instructions', async () => {
    const dry = loadFixture('quote.dry.base-usdc-near-usdc.json');
    dry.quote.depositAddress = '0xshould-not-be-here';
    const { fetchImpl } = createFetchMock(() => jsonResponse(dry, 201));
    const client = new OneClickClient({ fetchImpl });

    await expect(client.getDryQuote(PARAMS)).rejects.toBeInstanceOf(IntentsSchemaError);
  });

  it('rejects a decimal amount before making a network call', async () => {
    const { fetchImpl, calls } = createFetchMock(() => jsonResponse({}));
    const client = new OneClickClient({ fetchImpl });

    await expect(client.getDryQuote({ ...PARAMS, amount: '0.15' })).rejects.toBeInstanceOf(InvalidQuoteRequestError);
    expect(calls).toHaveLength(0);
  });

  it('blocks a non-dry quote without MEND_ALLOW_MAINNET and confirmMainnet', async () => {
    const live = loadFixture('quote.live.base-usdc-near-usdc.json');
    const { fetchImpl, calls } = createFetchMock(() => jsonResponse(live, 201));
    const client = new OneClickClient({ fetchImpl, env: {} });

    await expect(client.createDepositQuote(PARAMS, { confirmMainnet: true })).rejects.toBeInstanceOf(MainnetGuardError);
    expect(calls).toHaveLength(0);
  });

  it('blocks a non-dry quote when the explicit confirmation is missing', async () => {
    const live = loadFixture('quote.live.base-usdc-near-usdc.json');
    const { fetchImpl, calls } = createFetchMock(() => jsonResponse(live, 201));
    const client = new OneClickClient({ fetchImpl, env: { MEND_ALLOW_MAINNET: 'true' } });

    await expect(client.createDepositQuote(PARAMS, { confirmMainnet: false })).rejects.toBeInstanceOf(MainnetGuardError);
    expect(calls).toHaveLength(0);
  });

  it('allows a non-dry quote only with both guard conditions', async () => {
    const live = loadFixture('quote.live.base-usdc-near-usdc.json');
    const { fetchImpl, calls } = createFetchMock(() => jsonResponse(live, 201));
    const client = new OneClickClient({ fetchImpl, env: { MEND_ALLOW_MAINNET: 'true' } });

    const result = await client.createDepositQuote(PARAMS, { confirmMainnet: true, recipientReadiness: READINESS });
    expect(result.response.quote.depositAddress).toBe(LIVE_DEPOSIT_ADDRESS);
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
    expect(body.dry).toBe(false);
  });

  it('requires NEAR recipient readiness before a non-dry quote', async () => {
    const live = loadFixture('quote.live.base-usdc-near-usdc.json');
    const { fetchImpl, calls } = createFetchMock(() => jsonResponse(live, 201));
    const client = new OneClickClient({ fetchImpl, env: { MEND_ALLOW_MAINNET: 'true' } });

    await expect(client.createDepositQuote(PARAMS, { confirmMainnet: true })).rejects.toBeInstanceOf(NearRecipientCheckError);
    expect(calls).toHaveLength(0);
  });

  it('refuses a non-dry quote when the recipient account or storage is missing', async () => {
    const live = loadFixture('quote.live.base-usdc-near-usdc.json');
    const { fetchImpl, calls } = createFetchMock(() => jsonResponse(live, 201));
    const client = new OneClickClient({ fetchImpl, env: { MEND_ALLOW_MAINNET: 'true' } });

    await expect(
      client.createDepositQuote(PARAMS, { confirmMainnet: true, recipientReadiness: { ...READINESS, exists: false } }),
    ).rejects.toBeInstanceOf(NearRecipientCheckError);
    await expect(
      client.createDepositQuote(PARAMS, {
        confirmMainnet: true,
        recipientReadiness: { ...READINESS, storageRegistered: false, storageBalance: null },
      }),
    ).rejects.toBeInstanceOf(NearRecipientCheckError);
    expect(calls).toHaveLength(0);
  });

  it('allows an explicit diagnostic bypass for recipient readiness', async () => {
    const live = loadFixture('quote.live.base-usdc-near-usdc.json');
    const { fetchImpl } = createFetchMock(() => jsonResponse(live, 201));
    const client = new OneClickClient({ fetchImpl, env: { MEND_ALLOW_MAINNET: 'true' } });

    const result = await client.createDepositQuote(PARAMS, { confirmMainnet: true, allowUnverifiedRecipient: true });
    expect(result.response.quote.depositAddress).toBe(LIVE_DEPOSIT_ADDRESS);
  });

  it('rejects a non-dry response that omits the deposit address', async () => {
    const dry = loadFixture('quote.dry.base-usdc-near-usdc.json');
    const { fetchImpl } = createFetchMock(() => jsonResponse(dry, 201));
    const client = new OneClickClient({ fetchImpl, env: { MEND_ALLOW_MAINNET: 'true' } });

    await expect(
      client.createDepositQuote(PARAMS, { confirmMainnet: true, recipientReadiness: READINESS }),
    ).rejects.toBeInstanceOf(IntentsSchemaError);
  });

  it('fetches and verifies a pending status', async () => {
    const pending = loadFixture('status.pending-deposit.json');
    const { fetchImpl, calls } = createFetchMock(() => jsonResponse(pending));
    const client = new OneClickClient({ fetchImpl });

    const result = await client.getStatus(LIVE_DEPOSIT_ADDRESS);
    expect(result.verified).toBe(true);
    expect(result.response.status).toBe('PENDING_DEPOSIT');
    expect(calls[0]?.url).toContain(`depositAddress=${LIVE_DEPOSIT_ADDRESS}`);
  });

  it('adds depositMemo to the status query when required', async () => {
    const pending = loadFixture('status.pending-deposit.json');
    const { fetchImpl, calls } = createFetchMock(() => jsonResponse(pending));
    const client = new OneClickClient({ fetchImpl });

    await client.getStatus(LIVE_DEPOSIT_ADDRESS, { depositMemo: 'memo 1' });
    expect(calls[0]?.url).toContain('depositMemo=memo+1');
  });

  it('rejects a status without a signed quote by default', async () => {
    const excerpt = loadFixture('status.success.public-btc-sample.json');
    const { fetchImpl } = createFetchMock(() => jsonResponse(excerpt));
    const client = new OneClickClient({ fetchImpl });

    await expect(client.getStatus(LIVE_DEPOSIT_ADDRESS)).rejects.toBeInstanceOf(QuoteSignatureError);
  });

  it('accepts a recorded excerpt without a signature only when explicitly allowed', async () => {
    const excerpt = loadFixture('status.success.public-btc-sample.json');
    const { fetchImpl } = createFetchMock(() => jsonResponse(excerpt));
    const client = new OneClickClient({ fetchImpl });

    const result = await client.getStatus(LIVE_DEPOSIT_ADDRESS, { requireSignature: false });
    expect(result.verified).toBe(false);
    expect(result.response.status).toBe('SUCCESS');
  });

  it('rejects an invalid signature even when missing signatures are allowed', async () => {
    const pending = loadFixture('status.pending-deposit.json');
    const tampered = loadFixture('quote.dry.tampered-recipient.json');
    pending.quoteResponse = tampered;
    const { fetchImpl } = createFetchMock(() => jsonResponse(pending));
    const client = new OneClickClient({ fetchImpl });

    await expect(client.getStatus(LIVE_DEPOSIT_ADDRESS, { requireSignature: false })).rejects.toBeInstanceOf(QuoteSignatureError);
  });

  it('surfaces 404 and 429 errors without leaking headers or keys', async () => {
    const notFound = createFetchMock(() => jsonResponse({ message: 'not found', statusCode: 404 }, 404));
    const client404 = new OneClickClient({ fetchImpl: notFound.fetchImpl, apiKey: 'super-secret-jwt' });
    const error404 = await client404.getStatus('0x0000000000000000000000000000000000000000').catch((error: unknown) => error);
    expect(error404).toBeInstanceOf(IntentsApiError);
    expect((error404 as IntentsApiError).status).toBe(404);
    expect((error404 as IntentsApiError).message).not.toContain('super-secret-jwt');

    const limited = createFetchMock(() => jsonResponse({ message: 'rate limited', statusCode: 429 }, 429));
    const client429 = new OneClickClient({ fetchImpl: limited.fetchImpl });
    await expect(client429.getTokens()).rejects.toMatchObject({ status: 429 });
  });

  it('fails closed on a schema-invalid response', async () => {
    const { fetchImpl } = createFetchMock(() => jsonResponse([{ assetId: 'x' }]));
    const client = new OneClickClient({ fetchImpl });

    await expect(client.getTokens()).rejects.toBeInstanceOf(IntentsSchemaError);
  });

  it('wraps network failures and timeouts', async () => {
    const network = createFetchMock(() => {
      throw new Error('fetch failed');
    });
    const client = new OneClickClient({ fetchImpl: network.fetchImpl });
    await expect(client.getTokens()).rejects.toBeInstanceOf(IntentsNetworkError);

    const hangingFetch = (_input: string | URL | Request, init?: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    const timeoutClient = new OneClickClient({ fetchImpl: hangingFetch, timeoutMs: 5 });
    await expect(timeoutClient.getTokens()).rejects.toBeInstanceOf(IntentsTimeoutError);
  });

  it('polls with backoff until terminal', async () => {
    const pending = loadFixture('status.pending-deposit.json');
    const known = loadFixture('status.known-deposit-tx.synthetic.json');
    const success = loadFixture('status.success.near.synthetic.json');
    const { fetchImpl, calls } = createFetchMock((_url, _init, call) => {
      if (call === 1) return jsonResponse(pending);
      if (call === 2) return jsonResponse(known);
      return jsonResponse(success);
    });
    const client = new OneClickClient({ fetchImpl, now: () => new Date('2026-11-09T09:40:30.000Z') });

    const polled = await client.pollStatus(LIVE_DEPOSIT_ADDRESS, { sleep: async () => undefined });
    expect(polled.attempts).toBe(3);
    expect(polled.timedOut).toBe(false);
    expect(polled.tracked.rawStatus).toBe('SUCCESS');
    expect(polled.tracked.state).toBe('SUCCESS');
    expect(calls).toHaveLength(3);
  });

  it('stops polling at client-only expiry', async () => {
    const pending = loadFixture('status.pending-deposit.json');
    const { fetchImpl } = createFetchMock(() => jsonResponse(pending));
    const client = new OneClickClient({ fetchImpl });

    const polled = await client.pollStatus(LIVE_DEPOSIT_ADDRESS, {
      deadline: '2020-01-01T00:00:00.000Z',
      sleep: async () => undefined,
    });
    expect(polled.attempts).toBe(1);
    expect(polled.tracked.state).toBe('EXPIRED');
    expect(polled.timedOut).toBe(false);
  });

  it('reports a polling timeout instead of inventing a terminal state', async () => {
    const pending = loadFixture('status.pending-deposit.json');
    const { fetchImpl } = createFetchMock(() => jsonResponse(pending));
    let tick = 0;
    const client = new OneClickClient({ fetchImpl });
    const polled = await client.pollStatus(LIVE_DEPOSIT_ADDRESS, {
      timeoutMs: 2_500,
      sleep: async () => undefined,
      now: () => new Date(Date.parse('2026-11-09T09:40:30.000Z') + tick++ * 1_000),
    });
    expect(polled.timedOut).toBe(true);
    expect(polled.tracked.state).toBe('PENDING');
  });

  it('contains no signing or transaction-sending methods', () => {
    const client = new OneClickClient({ fetchImpl: createFetchMock(() => jsonResponse({})).fetchImpl });
    const surface = client as unknown as Record<string, unknown>;
    for (const name of ['sign', 'signTransaction', 'sendTransaction', 'send', 'transfer', 'depositSubmit']) {
      expect(surface[name]).toBeUndefined();
    }
  });
});
