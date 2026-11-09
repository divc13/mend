import { describe, expect, it } from 'vitest';
import { NearClientError, assertLiveCallsAllowed, loadNearClientConfig } from '../src/index.js';

describe('near client config', () => {
  it('defaults to an offline testnet profile', () => {
    const config = loadNearClientConfig({});
    expect(config.network).toBe('testnet');
    expect(config.hubAccount).toBe('mend-hub.testnet');
    expect(config.liveCalls).toBe(false);
    expect(config.mainnetApproved).toBe(false);
  });

  it('enables live calls only with an explicit flag', () => {
    const config = loadNearClientConfig({ MEND_LIVE_CALLS: '1' });
    expect(config.liveCalls).toBe(true);
    expect(() => assertLiveCallsAllowed(config)).not.toThrow();
  });

  it('blocks live calls by default', () => {
    const config = loadNearClientConfig({});
    expect(() => assertLiveCallsAllowed(config)).toThrow(NearClientError);
    try {
      assertLiveCallsAllowed(config);
    } catch (error) {
      expect((error as NearClientError).code).toBe('LIVE_CALLS_DISABLED');
    }
  });

  it('refuses mainnet without explicit human approval', () => {
    expect(() => loadNearClientConfig({ MEND_NEAR_NETWORK: 'mainnet' })).toThrow(/MAINNET_NOT_ALLOWED|mainnet/i);
  });

  it('refuses invalid accounts and timeouts', () => {
    expect(() => loadNearClientConfig({ MEND_HUB_ACCOUNT: 'NOT A VALID ACCOUNT' })).toThrow(NearClientError);
    expect(() => loadNearClientConfig({ MEND_RPC_TIMEOUT_MS: '1' })).toThrow(NearClientError);
  });
});
