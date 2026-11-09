import { describe, expect, it } from 'vitest';
import {
  HUMAN_SUPPLIED,
  MainnetGuardError,
  MainnetInputError,
  MainnetProfileError,
  MAINNET_PROFILE_DRAFT,
  NEAR_MAINNET_EXPLORER,
  NEAR_MAINNET_USDC,
  NEAR_MAINNET_USDC_ACCOUNT,
  NEAR_MAINNET_USDC_SOURCE_URL,
  assertMainnetProfileReady,
  buildMainnetAccountUrl,
  buildMainnetTxUrl,
  createMainnetProfile,
  loadConfig,
  missingMainnetProfileFields,
  publicConfig,
} from '../src/index.js';
import type { MainnetProfile } from '../src/index.js';

const READY_APPROVAL = { explicitApproval: true, humanConfirmed: true } as const;

function withApproval(
  profile: MainnetProfile,
  approval: MainnetProfile['approval'] = READY_APPROVAL,
): MainnetProfile {
  return { ...profile, approval };
}

describe('verified NEAR mainnet USDC token', () => {
  it('freezes the verified contract, symbol, decimals and provenance', () => {
    expect(NEAR_MAINNET_USDC).toMatchObject({
      account: '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
      symbol: 'USDC',
      decimals: 6,
      standard: 'NEP-141',
      source: {
        url: 'https://rpc.mainnet.near.org',
        method: 'ft_metadata',
        verifiedAt: '2026-11-09',
      },
    });
    expect(NEAR_MAINNET_USDC_ACCOUNT).toBe(NEAR_MAINNET_USDC.account);
    expect(NEAR_MAINNET_USDC_SOURCE_URL).toBe(NEAR_MAINNET_USDC.source.url);
    expect(Object.isFrozen(NEAR_MAINNET_USDC)).toBe(true);
    expect(Object.isFrozen(NEAR_MAINNET_USDC.source)).toBe(true);
    expect(NEAR_MAINNET_EXPLORER).toBe('https://nearblocks.io');
  });

  it('cannot be mutated at runtime', () => {
    const mutable = NEAR_MAINNET_USDC as unknown as Record<string, unknown>;
    expect(Reflect.set(mutable, 'decimals', 8)).toBe(false);
    expect(Reflect.set(mutable, 'account', 'attacker.near')).toBe(false);
    expect(NEAR_MAINNET_USDC.decimals).toBe(6);
    expect(NEAR_MAINNET_USDC.account).toBe(NEAR_MAINNET_USDC_ACCOUNT);
  });
});

describe('mainnet draft profile', () => {
  it('uses explicit human-supplied placeholders, never invented values', () => {
    expect(MAINNET_PROFILE_DRAFT).toMatchObject({
      network: 'near-mainnet',
      hubAccount: HUMAN_SUPPLIED,
      sponsorAccount: HUMAN_SUPPLIED,
      rpcUrl: HUMAN_SUPPLIED,
      usdc: NEAR_MAINNET_USDC,
      approval: { explicitApproval: false, humanConfirmed: false },
    });
    expect(missingMainnetProfileFields(MAINNET_PROFILE_DRAFT)).toEqual([
      'hubAccount',
      'sponsorAccount',
      'rpcUrl',
    ]);
    expect(Object.isFrozen(MAINNET_PROFILE_DRAFT)).toBe(true);
    expect(Object.isFrozen(MAINNET_PROFILE_DRAFT.approval)).toBe(true);
  });
});

describe('assertMainnetProfileReady', () => {
  it('fails closed on the draft because approval is missing', () => {
    expect(() => assertMainnetProfileReady(MAINNET_PROFILE_DRAFT)).toThrow(MainnetGuardError);
  });

  it('fails closed when hub account is still human-supplied even with approval', () => {
    const profile = withApproval(MAINNET_PROFILE_DRAFT);
    expect(() => assertMainnetProfileReady(profile)).toThrow(MainnetProfileError);
    try {
      assertMainnetProfileReady(profile);
    } catch (error) {
      expect(error).toBeInstanceOf(MainnetProfileError);
      expect((error as MainnetProfileError).missing).toContain('hubAccount');
      expect((error as MainnetProfileError).code).toBe('MAINNET_PROFILE_NOT_READY');
    }
  });

  it('fails closed when sponsor or RPC is still human-supplied', () => {
    const profile = withApproval({
      ...MAINNET_PROFILE_DRAFT,
      hubAccount: 'mend-hub.near',
      sponsorAccount: HUMAN_SUPPLIED,
      rpcUrl: HUMAN_SUPPLIED,
    });
    expect(() => assertMainnetProfileReady(profile)).toThrow(/sponsorAccount, rpcUrl/);
  });

  it('requires both approval signals after the operator fields are filled', () => {
    const profile: MainnetProfile = {
      ...MAINNET_PROFILE_DRAFT,
      hubAccount: 'mend-hub.near',
      sponsorAccount: 'mend-sponsor.near',
      rpcUrl: 'https://rpc.mainnet.near.org',
    };
    expect(() => assertMainnetProfileReady(profile)).toThrow(MainnetGuardError);
    expect(() =>
      assertMainnetProfileReady(withApproval(profile, { explicitApproval: true, humanConfirmed: false })),
    ).toThrow(MainnetGuardError);
    expect(() => assertMainnetProfileReady(withApproval(profile))).not.toThrow();
  });

  it('rejects non-https or credential-bearing RPC URLs', () => {
    const base: MainnetProfile = {
      ...MAINNET_PROFILE_DRAFT,
      hubAccount: 'mend-hub.near',
      sponsorAccount: 'mend-sponsor.near',
      rpcUrl: 'http://rpc.example.test',
    };
    expect(() => assertMainnetProfileReady(withApproval(base))).toThrow(MainnetInputError);
    expect(() =>
      assertMainnetProfileReady(
        withApproval({ ...base, rpcUrl: 'https://user:pass@rpc.example.test' }),
      ),
    ).toThrow(/embedded credentials/);
  });

  it('accepts a fully human-supplied profile and freezes the result from createMainnetProfile', () => {
    const profile = createMainnetProfile({
      hubAccount: 'mend-hub.near',
      sponsorAccount: 'mend-sponsor.near',
      rpcUrl: 'https://rpc.mainnet.near.org',
      approval: READY_APPROVAL,
    });
    expect(profile.usdc).toBe(NEAR_MAINNET_USDC);
    expect(profile.approval).toEqual(READY_APPROVAL);
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.approval)).toBe(true);
    expect(() => assertMainnetProfileReady(profile)).not.toThrow();
  });

  it('rejects blank human input instead of silently accepting it', () => {
    expect(() =>
      createMainnetProfile({
        hubAccount: '   ',
        sponsorAccount: 'mend-sponsor.near',
        rpcUrl: 'https://rpc.mainnet.near.org',
        approval: READY_APPROVAL,
      }),
    ).toThrow(MainnetInputError);
  });
});

describe('mainnet explorer URL builders', () => {
  it('builds NEAR mainnet account and transaction links', () => {
    expect(buildMainnetAccountUrl('mend-hub.near')).toBe(
      'https://nearblocks.io/address/mend-hub.near',
    );
    expect(buildMainnetTxUrl('abc123')).toBe('https://nearblocks.io/txns/abc123');
  });

  it('encodes segments and rejects blank input', () => {
    expect(buildMainnetAccountUrl(' account with space ')).toBe(
      'https://nearblocks.io/address/account%20with%20space',
    );
    expect(buildMainnetTxUrl('hash/with?chars')).toBe(
      'https://nearblocks.io/txns/hash%2Fwith%3Fchars',
    );
    expect(() => buildMainnetAccountUrl('')).toThrow(MainnetInputError);
    expect(() => buildMainnetTxUrl('   ')).toThrow(MainnetInputError);
  });
});

describe('secret and mode boundaries', () => {
  it('exposes no secret-shaped fields in the profile or public config', () => {
    const profile = createMainnetProfile({
      hubAccount: 'mend-hub.near',
      sponsorAccount: 'mend-sponsor.near',
      rpcUrl: 'https://rpc.mainnet.near.org',
      approval: READY_APPROVAL,
    });
    const keys: string[] = [];
    const visit = (value: unknown): void => {
      if (value === null || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        keys.push(key);
        visit(child);
      }
    };
    visit(profile);
    visit(publicConfig(loadConfig({})));

    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => /secret|private|mnemonic|passphrase|password|api.?key/i.test(key))).toEqual([]);
    expect(JSON.stringify(profile)).not.toMatch(/secret|private|mnemonic|passphrase|password/i);
  });

  it('never selects the mainnet profile through environment loading', () => {
    expect(loadConfig({}).mode).toBe('REPLAY');
    expect(loadConfig({ MEND_MODE: 'LIVE_TESTNET' }).mode).toBe('LIVE_TESTNET');

    const mainnetConfig = loadConfig({
      MEND_MODE: 'MAINNET',
      MEND_MAINNET_EXPLICIT_APPROVAL: 'true',
      MEND_MAINNET_HUMAN_CONFIRMED: 'true',
    });
    expect(mainnetConfig.mode).toBe('MAINNET');
    expect(mainnetConfig).not.toHaveProperty('hubAccount');
    expect(mainnetConfig).not.toHaveProperty('sponsorAccount');
    expect(mainnetConfig).not.toHaveProperty('usdc');

    const safe = publicConfig(mainnetConfig);
    expect(JSON.stringify(safe)).not.toContain(NEAR_MAINNET_USDC_ACCOUNT);
    expect(JSON.stringify(safe)).not.toContain('near-mainnet');
    expect(safe).not.toHaveProperty('hubAccount');
    expect(safe).not.toHaveProperty('sponsorAccount');
    expect(safe).not.toHaveProperty('rpcUrl');
  });
});
