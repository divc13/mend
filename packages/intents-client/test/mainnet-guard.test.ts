import { describe, expect, it } from 'vitest';
import {
  MAINNET_ONLY_LABEL,
  assertMainnetExecutionAllowed,
  isMainnetExecutionAllowed,
} from '../src/mainnet-guard.js';
import { MainnetGuardError } from '../src/errors.js';
import { OneClickClient } from '../src/client.js';
import { BASE_USDC, NEAR_USDC, createFetchMock, jsonResponse, loadFixture } from './helpers.js';

const PARAMS = {
  originAsset: BASE_USDC,
  destinationAsset: NEAR_USDC,
  amount: '10000000',
  recipient: 'mend.near',
  refundTo: '0x1111111111111111111111111111111111111111',
};

describe('mainnet guard', () => {
  it('always allows dry quotes', () => {
    expect(() => assertMainnetExecutionAllowed({ dry: true, env: {} })).not.toThrow();
    expect(isMainnetExecutionAllowed({ dry: true, env: {} })).toBe(true);
  });

  it('blocks non-dry execution when both conditions are missing', () => {
    try {
      assertMainnetExecutionAllowed({ dry: false, env: {} });
      throw new Error('expected guard to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(MainnetGuardError);
      expect((error as MainnetGuardError).missing).toEqual(['MEND_ALLOW_MAINNET', 'confirmMainnet']);
      expect((error as MainnetGuardError).message).toContain('MAINNET ONLY');
    }
  });

  it('blocks when MEND_ALLOW_MAINNET is true but confirmation is missing', () => {
    expect(() => assertMainnetExecutionAllowed({ dry: false, env: { MEND_ALLOW_MAINNET: 'true' } })).toThrow(MainnetGuardError);
    expect(() =>
      assertMainnetExecutionAllowed({ dry: false, env: { MEND_ALLOW_MAINNET: 'true' }, confirmMainnet: false }),
    ).toThrow(MainnetGuardError);
  });

  it('blocks when confirmation is true but MEND_ALLOW_MAINNET is missing or not exactly true', () => {
    for (const env of [{}, { MEND_ALLOW_MAINNET: '1' }, { MEND_ALLOW_MAINNET: 'TRUE' }, { MEND_ALLOW_MAINNET: 'false' }]) {
      expect(() => assertMainnetExecutionAllowed({ dry: false, env, confirmMainnet: true })).toThrow(MainnetGuardError);
    }
  });

  it('allows non-dry execution only when both conditions hold', () => {
    expect(() =>
      assertMainnetExecutionAllowed({ dry: false, env: { MEND_ALLOW_MAINNET: 'true' }, confirmMainnet: true }),
    ).not.toThrow();
    expect(isMainnetExecutionAllowed({ dry: false, env: { MEND_ALLOW_MAINNET: 'true' }, confirmMainnet: true })).toBe(true);
  });

  it('prevents the client from making a non-dry request before the guard passes', async () => {
    const live = loadFixture('quote.live.base-usdc-near-usdc.json');
    const { fetchImpl, calls } = createFetchMock(() => jsonResponse(live, 201));
    const client = new OneClickClient({ fetchImpl, env: {} });

    await expect(client.createDepositQuote(PARAMS, { confirmMainnet: true })).rejects.toBeInstanceOf(MainnetGuardError);
    expect(calls).toHaveLength(0);
  });

  it('exposes a mainnet-only label', () => {
    expect(MAINNET_ONLY_LABEL).toContain('MAINNET ONLY');
    expect(MAINNET_ONLY_LABEL).toContain('real funds');
  });
});
