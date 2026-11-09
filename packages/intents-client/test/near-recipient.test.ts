import { describe, expect, it } from 'vitest';
import { assertNearRecipientReady, checkNearRecipientReadiness } from '../src/near-recipient.js';
import { NearRecipientCheckError } from '../src/errors.js';
import { READINESS, createFetchMock, jsonResponse, loadFixture } from './helpers.js';

const TOKEN_ACCOUNT = '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';
const NOW = new Date('2026-11-09T09:38:00.000Z');

function options(fetchImpl: ReturnType<typeof createFetchMock>['fetchImpl']) {
  return {
    accountId: 'mend.near',
    tokenAccount: TOKEN_ACCOUNT,
    fetchImpl,
    now: () => NOW,
  };
}

describe('NEAR recipient readiness', () => {
  it('reports an existing account with registered NEP-141 storage', async () => {
    const view = loadFixture('near-rpc.view-account.exists.json');
    const storage = loadFixture('near-rpc.storage.registered.json');
    const { fetchImpl, calls } = createFetchMock((_url, _init, call) => jsonResponse(call === 1 ? view : storage));

    const readiness = await checkNearRecipientReadiness(options(fetchImpl));
    expect(readiness.exists).toBe(true);
    expect(readiness.storageRegistered).toBe(true);
    expect(readiness.storageBalance).toEqual({ total: '1250000000000000000000', available: '0' });
    expect(readiness.accountAmountYocto).toBe('6000000000000000000000000');
    expect(readiness.error).toBeNull();
    expect(readiness.checkedAt).toBe(NOW.toISOString());

    const viewBody = JSON.parse(String(calls[0]?.init.body)) as { params: Record<string, unknown> };
    expect(viewBody.params.account_id).toBe('mend.near');
    expect(viewBody.params.request_type).toBe('view_account');

    const storageBody = JSON.parse(String(calls[1]?.init.body)) as { params: Record<string, unknown> };
    expect(storageBody.params.account_id).toBe(TOKEN_ACCOUNT);
    expect(storageBody.params.method_name).toBe('storage_balance_of');
    const decodedArgs = JSON.parse(Buffer.from(String(storageBody.params.args_base64), 'base64').toString('utf8')) as { account_id: string };
    expect(decodedArgs.account_id).toBe('mend.near');
  });

  it('reports an existing account without NEP-141 storage', async () => {
    const view = loadFixture('near-rpc.view-account.exists.json');
    const storage = loadFixture('near-rpc.storage.null.json');
    const { fetchImpl } = createFetchMock((_url, _init, call) => jsonResponse(call === 1 ? view : storage));

    const readiness = await checkNearRecipientReadiness(options(fetchImpl));
    expect(readiness.exists).toBe(true);
    expect(readiness.storageRegistered).toBe(false);
    expect(readiness.storageBalance).toBeNull();
    expect(readiness.error).toBe('STORAGE_NOT_REGISTERED');
  });

  it('reports a missing named account without making the storage call', async () => {
    const unknown = loadFixture('near-rpc.view-account.unknown.json');
    const { fetchImpl, calls } = createFetchMock(() => jsonResponse(unknown));

    const readiness = await checkNearRecipientReadiness(options(fetchImpl));
    expect(readiness.exists).toBe(false);
    expect(readiness.storageRegistered).toBe(false);
    expect(readiness.error).toBe('UNKNOWN_ACCOUNT');
    expect(calls).toHaveLength(1);
  });

  it('asserts readiness only for an existing account with registered storage', () => {
    expect(() => assertNearRecipientReady(READINESS)).not.toThrow();
    expect(() => assertNearRecipientReady({ ...READINESS, exists: false })).toThrow(NearRecipientCheckError);
    expect(() =>
      assertNearRecipientReady({ ...READINESS, storageRegistered: false, storageBalance: null }),
    ).toThrow(NearRecipientCheckError);
  });

  it('fails honestly on non-JSON RPC responses', async () => {
    const { fetchImpl } = createFetchMock(() => new Response('not json', { status: 200 }));
    await expect(checkNearRecipientReadiness(options(fetchImpl))).rejects.toBeInstanceOf(NearRecipientCheckError);
  });

  it('fails honestly on RPC network errors', async () => {
    const { fetchImpl } = createFetchMock(() => {
      throw new Error('fetch failed');
    });
    await expect(checkNearRecipientReadiness(options(fetchImpl))).rejects.toBeInstanceOf(NearRecipientCheckError);
  });
});
