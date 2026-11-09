import { describe, expect, it, vi } from 'vitest';
import {
  REDACTED,
  SecretBoundaryError,
  assertServerOnly,
  containsSecret,
  loadConfig,
  publicConfig,
  redactSecrets,
} from '../src/index.js';
import { loadServerConfig } from '../src/server.js';

describe('secret boundaries', () => {
  it('redacts every supplied secret, longest first', () => {
    const text = 'token=abc123; long=abcdef; password=hunter2';
    const redacted = redactSecrets(text, ['abc', 'abcdef', 'hunter2']);
    expect(redacted).toBe(`token=${REDACTED}123; long=${REDACTED}; password=${REDACTED}`);
    expect(redacted).not.toContain('hunter2');
    expect(redacted).not.toContain('abcdef');
  });

  it('ignores missing and empty values without mangling the message', () => {
    expect(redactSecrets('hello world', [undefined, null, ''])).toBe('hello world');
  });

  it('detects whether text contains a secret', () => {
    expect(containsSecret('value=secret-1', ['secret-1'])).toBe(true);
    expect(containsSecret('value=public', ['secret-1', ''])).toBe(false);
  });

  it('passes in Node and throws in browser-like globals', () => {
    expect(() => assertServerOnly()).not.toThrow();

    const scope = globalThis as { window?: unknown; document?: unknown; importScripts?: unknown };
    scope.window = {};
    try {
      expect(() => assertServerOnly()).toThrow(SecretBoundaryError);
    } finally {
      delete scope.window;
    }

    scope.document = {};
    try {
      expect(() => assertServerOnly()).toThrow(/browser-like/i);
    } finally {
      delete scope.document;
    }

    scope.importScripts = () => undefined;
    try {
      expect(() => assertServerOnly()).toThrow(SecretBoundaryError);
    } finally {
      delete scope.importScripts;
    }
  });

  it('returns only non-secret public fields', () => {
    const secret = 'do-not-ship-this';
    const config = loadConfig({
      MEND_MODE: 'LIVE_TESTNET',
      MEND_API_URL: 'https://api.example.test',
      MEND_EVIDENCE_SIGNING_SECRET: secret,
      MEND_EVIDENCE_DIR: '/private/evidence',
      MEND_FEATURE_INTENTS: 'true',
    });
    const safe = publicConfig(config);

    expect(safe).toMatchObject({
      mode: 'LIVE_TESTNET',
      apiUrl: 'https://api.example.test',
      features: { intents: true, agentMarket: false, aiTriage: false, demoReset: false },
    });
    expect(safe.modeLabel).toMatch(/LIVE TESTNET/);
    expect('signingSecret' in safe.evidence).toBe(false);
    expect('dir' in safe.evidence).toBe(false);
    expect(JSON.stringify(safe)).not.toContain(secret);
    expect(JSON.stringify(safe)).not.toContain('/private/evidence');
    expect(Object.isFrozen(safe)).toBe(true);
    expect(Object.isFrozen(safe.evidence)).toBe(true);
    expect(Object.isFrozen(safe.features)).toBe(true);
  });

  it('refuses server-only loading in a browser-like context', () => {
    expect(loadServerConfig({}).mode).toBe('REPLAY');
    const scope = globalThis as { window?: unknown };
    scope.window = {};
    try {
      expect(() => loadServerConfig({ MEND_EVIDENCE_SIGNING_SECRET: 'secret' })).toThrow(
        SecretBoundaryError,
      );
    } finally {
      delete scope.window;
    }
  });

  it('never writes configuration or secrets to the console', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      loadConfig({
        MEND_MODE: 'LIVE_TESTNET',
        MEND_EVIDENCE_SIGNING_SECRET: 'console-secret',
        MEND_FEATURE_INTENTS: 'true',
      });
      expect(debug).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
      expect(info).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      debug.mockRestore();
      log.mockRestore();
      info.mockRestore();
      warn.mockRestore();
      error.mockRestore();
    }
  });

  it('does not read or validate the environment at import time', async () => {
    const previous = process.env.MEND_MODE;
    process.env.MEND_MODE = 'NOT_A_REAL_MODE';
    try {
      vi.resetModules();
      await expect(import('../src/index.js')).resolves.toBeDefined();
      // The loader itself still rejects the same value when called.
      expect(() => loadConfig({ MEND_MODE: 'NOT_A_REAL_MODE' })).toThrow();
    } finally {
      if (previous === undefined) delete process.env.MEND_MODE;
      else process.env.MEND_MODE = previous;
    }
  });
});
