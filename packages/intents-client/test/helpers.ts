import { readFileSync } from 'node:fs';
import type { FetchLike } from '../src/client.js';
import { ExecutionStatusResponseSchema, type ExecutionStatusResponse } from '../src/schemas.js';
import type { NearRecipientReadiness } from '../src/near-recipient.js';
import type { StatusLike } from '../src/status.js';

export function loadFixture<T = any>(name: string): T {
  const url = new URL(`../../../fixtures/payments/${name}`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as T;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export interface CapturedRequest {
  url: string;
  init: RequestInit;
}

export function createFetchMock(
  handler: (url: string, init: RequestInit, call: number) => Response | Promise<Response>,
): { fetchImpl: FetchLike; calls: CapturedRequest[] } {
  const calls: CapturedRequest[] = [];
  const fetchImpl: FetchLike = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    return handler(url, init, calls.length);
  };
  return { fetchImpl, calls };
}

export function statusLike(raw: unknown, verified = true): StatusLike {
  const response: ExecutionStatusResponse = ExecutionStatusResponseSchema.parse(raw);
  return { response, raw, verified };
}

export const NEAR_USDC = 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';
export const BASE_USDC = 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near';
export const LIVE_DEPOSIT_ADDRESS = '0x5eFF1eda63DF64B9831483888702e56Ea62Def95';
export const WORK_ORDER_ID = 'WO-BENCH-001-0001';
export const NEAR_USDC_CONTRACT = '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';

export const READINESS: NearRecipientReadiness = {
  accountId: 'mend.near',
  tokenAccount: NEAR_USDC_CONTRACT,
  rpcUrl: 'https://rpc.mainnet.near.org',
  exists: true,
  storageRegistered: true,
  storageBalance: { total: '1250000000000000000000', available: '0' },
  accountAmountYocto: '6000000000000000000000000',
  checkedAt: '2026-11-09T09:38:00.000Z',
  error: null,
};
