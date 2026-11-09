import { modeLabel } from './mode.js';
import type { MendConfig, PublicMendConfig } from './types.js';

export const REDACTED = '[REDACTED]';

export type SecretBoundaryCode = 'SECRET_LEAK' | 'BROWSER_CONTEXT';

export class SecretBoundaryError extends Error {
  readonly code: SecretBoundaryCode;

  constructor(code: SecretBoundaryCode, message: string) {
    super(message);
    this.name = 'SecretBoundaryError';
    this.code = code;
  }
}

function usableSecrets(values: readonly (string | null | undefined)[]): string[] {
  return values
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    // Longest first so a short substring cannot preserve part of a longer secret.
    .sort((a, b) => b.length - a.length);
}

/**
 * Replaces every occurrence of the supplied secret values in `text`.
 * Empty values are ignored so a missing credential cannot blank the message.
 * This intentionally uses split/join rather than regular expressions so secret
 * characters never need escaping.
 */
export function redactSecrets(text: string, values: readonly (string | null | undefined)[]): string {
  let output = text;
  for (const secret of usableSecrets(values)) {
    output = output.split(secret).join(REDACTED);
  }
  return output;
}

export function containsSecret(text: string, values: readonly (string | null | undefined)[]): boolean {
  return usableSecrets(values).some((secret) => text.includes(secret));
}

/**
 * Throws when called with browser-like globals present. Server-only modules can
 * call this at their entry point; the check itself has no import-time side
 * effects and never reads credentials.
 */
export function assertServerOnly(): void {
  const scope = globalThis as {
    window?: unknown;
    document?: unknown;
    importScripts?: unknown;
  };
  const browserLike = typeof scope.window !== 'undefined'
    || typeof scope.document !== 'undefined'
    || typeof scope.importScripts === 'function';
  if (browserLike) {
    throw new SecretBoundaryError(
      'BROWSER_CONTEXT',
      'Server-only MEND module loaded in a browser-like context; refusing to expose secrets',
    );
  }
}

/**
 * Explicit allow-list projection. Constructing the result field by field means
 * a new secret added to `MendConfig` is private by default until it is added
 * here deliberately.
 */
export function publicConfig(config: MendConfig): PublicMendConfig {
  const safe: PublicMendConfig = {
    mode: config.mode,
    modeLabel: modeLabel(config.mode),
    nodeEnv: config.nodeEnv,
    apiUrl: config.apiUrl,
    webUrl: config.webUrl,
    workerUrl: config.workerUrl,
    evidence: {
      adapter: config.evidence.adapter,
      maxBytes: config.evidence.maxBytes,
      signedUrlTtlSeconds: config.evidence.signedUrlTtlSeconds,
    },
    features: {
      intents: config.features.intents,
      agentMarket: config.features.agentMarket,
      aiTriage: config.features.aiTriage,
      demoReset: config.features.demoReset,
    },
  };
  Object.freeze(safe.evidence);
  Object.freeze(safe.features);
  return Object.freeze(safe);
}
