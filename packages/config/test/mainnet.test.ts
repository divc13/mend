import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  MainnetGuardError,
  assertMainnetAllowed,
  assertModeAllowed,
  loadConfig,
  modeLabel,
  NO_MAINNET_APPROVAL,
} from '../src/index.js';

describe('mainnet guard', () => {
  it('allows MAINNET only when explicit approval and human confirmation are both true', () => {
    expect(() => assertMainnetAllowed({ explicitApproval: true, humanConfirmed: true })).not.toThrow();
    expect(() => assertModeAllowed('MAINNET', { explicitApproval: true, humanConfirmed: true })).not.toThrow();
  });

  it.each([
    { explicitApproval: true, humanConfirmed: false, missing: 'humanConfirmed' },
    { explicitApproval: false, humanConfirmed: true, missing: 'explicitApproval' },
    { explicitApproval: false, humanConfirmed: false, missing: 'explicitApproval, humanConfirmed' },
  ])('fails closed for $explicitApproval/$humanConfirmed', ({ explicitApproval, humanConfirmed, missing }) => {
    expect(() => assertMainnetAllowed({ explicitApproval, humanConfirmed })).toThrow(MainnetGuardError);
    expect(() => assertModeAllowed('MAINNET', { explicitApproval, humanConfirmed })).toThrow(
      new RegExp(missing),
    );
  });

  it('does not accept truthy non-boolean approval values', () => {
    const approval = { explicitApproval: 1, humanConfirmed: 'yes' } as unknown as {
      explicitApproval: boolean;
      humanConfirmed: boolean;
    };
    expect(() => assertMainnetAllowed(approval)).toThrow(MainnetGuardError);
  });

  it('fails closed when approval input is missing entirely', () => {
    expect(() => assertMainnetAllowed(undefined as never)).toThrow(MainnetGuardError);
  });

  it('leaves REPLAY and LIVE_TESTNET unaffected', () => {
    expect(() => assertModeAllowed('REPLAY')).not.toThrow();
    expect(() => assertModeAllowed('LIVE_TESTNET')).not.toThrow();
    expect(() => assertModeAllowed('REPLAY', NO_MAINNET_APPROVAL)).not.toThrow();
    expect(() => assertModeAllowed('LIVE_TESTNET', NO_MAINNET_APPROVAL)).not.toThrow();
  });
});

describe('environment loader', () => {
  it('defaults to a safe local REPLAY profile', () => {
    const config = loadConfig({});
    expect(config.mode).toBe('REPLAY');
    expect(modeLabel(config.mode)).toMatch(/REPLAY/);
    expect(config.apiUrl).toBe('http://127.0.0.1:4010');
    expect(config.webUrl).toBe('http://127.0.0.1:3000');
    expect(config.workerUrl).toBe('http://127.0.0.1:4200');
    expect(config.evidence.adapter).toBe('local');
    expect(config.evidence.signingSecret).toBeUndefined();
    expect(config.features).toEqual({
      intents: false,
      agentMarket: false,
      aiTriage: false,
      demoReset: false,
    });
    expect(config.mainnet).toEqual({ explicitApproval: false, humanConfirmed: false });
  });

  it('parses explicit mode, URLs, evidence settings and feature flags', () => {
    const config = loadConfig({
      MEND_MODE: 'LIVE_TESTNET',
      NODE_ENV: 'test',
      MEND_API_URL: 'http://api.example.test:4100',
      MEND_WEB_URL: 'https://app.example.test',
      MEND_WORKER_URL: 'https://worker.example.test',
      MEND_EVIDENCE_ADAPTER: 's3',
      MEND_EVIDENCE_DIR: '/private/evidence',
      MEND_EVIDENCE_MAX_BYTES: '1024',
      MEND_EVIDENCE_URL_TTL_SECONDS: '60',
      MEND_EVIDENCE_SIGNING_SECRET: 'super-secret-value',
      MEND_FEATURE_INTENTS: 'true',
      MEND_FEATURE_AGENT_MARKET: '1',
      MEND_FEATURE_AI_TRIAGE: 'off',
      MEND_FEATURE_DEMO_RESET: 'yes',
    });
    expect(config.mode).toBe('LIVE_TESTNET');
    expect(modeLabel(config.mode)).toMatch(/LIVE TESTNET/);
    expect(config.apiUrl).toBe('http://api.example.test:4100');
    expect(config.evidence).toMatchObject({
      adapter: 's3',
      dir: '/private/evidence',
      maxBytes: 1024,
      signedUrlTtlSeconds: 60,
      signingSecret: 'super-secret-value',
    });
    expect(config.features).toEqual({
      intents: true,
      agentMarket: true,
      aiTriage: false,
      demoReset: true,
    });
  });

  it('never defaults to MAINNET and refuses it without both approvals', () => {
    expect(() => loadConfig({ MEND_MODE: 'MAINNET' })).toThrow(MainnetGuardError);
    expect(() =>
      loadConfig({ MEND_MODE: 'MAINNET', MEND_MAINNET_EXPLICIT_APPROVAL: '1' }),
    ).toThrow(MainnetGuardError);
    expect(() =>
      loadConfig({ MEND_MODE: 'MAINNET', MEND_MAINNET_HUMAN_CONFIRMED: '1' }),
    ).toThrow(MainnetGuardError);
  });

  it('loads MAINNET only when both approval signals are explicit', () => {
    const config = loadConfig({
      MEND_MODE: 'MAINNET',
      MEND_MAINNET_EXPLICIT_APPROVAL: 'true',
      MEND_MAINNET_HUMAN_CONFIRMED: '1',
    });
    expect(config.mode).toBe('MAINNET');
    expect(modeLabel(config.mode)).toMatch(/MAINNET/);
    expect(config.mainnet).toEqual({ explicitApproval: true, humanConfirmed: true });
  });

  it('rejects unknown modes, malformed flags, URLs and blank secrets', () => {
    expect(() => loadConfig({ MEND_MODE: 'PRODUCTION' })).toThrow(ConfigError);
    expect(() => loadConfig({ MEND_FEATURE_INTENTS: 'sometimes' })).toThrow(ConfigError);
    expect(() => loadConfig({ MEND_API_URL: 'not a url' })).toThrow(ConfigError);
    expect(() => loadConfig({ MEND_API_URL: 'https://user:pass@example.test' })).toThrow(ConfigError);
    expect(() => loadConfig({ MEND_EVIDENCE_MAX_BYTES: '0' })).toThrow(ConfigError);
    expect(() => loadConfig({ MEND_EVIDENCE_SIGNING_SECRET: '   ' })).toThrow(ConfigError);
  });
});
