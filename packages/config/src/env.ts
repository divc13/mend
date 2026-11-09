import { z } from 'zod';
import { MEND_MODES } from './mode.js';
import { assertModeAllowed } from './mainnet.js';
import type { EvidenceAdapterKind, FeatureFlags, MendConfig } from './types.js';

export type EnvLike = Record<string, string | undefined>;

export const DEFAULT_API_URL = 'http://127.0.0.1:4010';
export const DEFAULT_WEB_URL = 'http://127.0.0.1:3000';
export const DEFAULT_WORKER_URL = 'http://127.0.0.1:4200';
export const DEFAULT_EVIDENCE_DIR = '.evidence';
export const DEFAULT_EVIDENCE_MAX_BYTES = 8 * 1024 * 1024;
export const DEFAULT_EVIDENCE_URL_TTL_SECONDS = 300;

const ENV_TRUE = new Set(['1', 'true', 'yes', 'on']);
const ENV_FALSE = new Set(['0', 'false', 'no', 'off']);

function envBoolean(defaultValue: boolean) {
  return z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === '') return defaultValue;
      const normalized = value.toLowerCase();
      if (ENV_TRUE.has(normalized)) return true;
      if (ENV_FALSE.has(normalized)) return false;
      ctx.addIssue({ code: 'custom', message: `expected a boolean flag, received ${JSON.stringify(value)}` });
      return z.NEVER;
    });
}

function urlWithoutCredentials(label: string) {
  return z.url().refine(
    (value) => {
      try {
        const parsed = new URL(value);
        return parsed.username === '' && parsed.password === '';
      } catch {
        return false;
      }
    },
    { message: `${label} must be a valid URL without embedded credentials` },
  );
}

/**
 * Environment fields parsed into a typed shape. Secrets are deliberately read
 * outside this schema so a validation error can never echo a credential.
 */
const EnvironmentSchema = z.object({
  MEND_MODE: z.enum(MEND_MODES).default('REPLAY'),
  NODE_ENV: z.string().min(1).default('development'),
  MEND_API_URL: urlWithoutCredentials('MEND_API_URL').default(DEFAULT_API_URL),
  MEND_WEB_URL: urlWithoutCredentials('MEND_WEB_URL').default(DEFAULT_WEB_URL),
  MEND_WORKER_URL: urlWithoutCredentials('MEND_WORKER_URL').default(DEFAULT_WORKER_URL),
  MEND_EVIDENCE_ADAPTER: z.enum(['local', 's3', 'unavailable']).default('local'),
  MEND_EVIDENCE_DIR: z.string().min(1).default(DEFAULT_EVIDENCE_DIR),
  MEND_EVIDENCE_MAX_BYTES: z.coerce.number().int().positive().default(DEFAULT_EVIDENCE_MAX_BYTES),
  MEND_EVIDENCE_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_EVIDENCE_URL_TTL_SECONDS),
  MEND_FEATURE_INTENTS: envBoolean(false),
  MEND_FEATURE_AGENT_MARKET: envBoolean(false),
  MEND_FEATURE_AI_TRIAGE: envBoolean(false),
  MEND_FEATURE_DEMO_RESET: envBoolean(false),
  MEND_MAINNET_EXPLICIT_APPROVAL: envBoolean(false),
  MEND_MAINNET_HUMAN_CONFIRMED: envBoolean(false),
});

export class ConfigError extends Error {
  readonly code = 'INVALID_CONFIG' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Loads and validates all runtime configuration. Safe defaults select REPLAY
 * and local-only URLs. MAINNET is never selected implicitly: when requested,
 * both mainnet approval signals must be present or the load fails closed.
 *
 * No environment value is read at module import time.
 */
export function loadConfig(env: EnvLike = process.env): MendConfig {
  const parsed = EnvironmentSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(`invalid MEND environment: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  }
  const values = parsed.data;

  const explicitApproval = values.MEND_MAINNET_EXPLICIT_APPROVAL;
  const humanConfirmed = values.MEND_MAINNET_HUMAN_CONFIRMED;
  const mainnet = { explicitApproval, humanConfirmed };
  assertModeAllowed(values.MEND_MODE, mainnet);

  const signingSecret = env.MEND_EVIDENCE_SIGNING_SECRET;
  if (signingSecret !== undefined && signingSecret.trim() === '') {
    throw new ConfigError('MEND_EVIDENCE_SIGNING_SECRET must not be blank');
  }

  const features: FeatureFlags = {
    intents: values.MEND_FEATURE_INTENTS,
    agentMarket: values.MEND_FEATURE_AGENT_MARKET,
    aiTriage: values.MEND_FEATURE_AI_TRIAGE,
    demoReset: values.MEND_FEATURE_DEMO_RESET,
  };

  return {
    mode: values.MEND_MODE,
    nodeEnv: values.NODE_ENV,
    apiUrl: values.MEND_API_URL,
    webUrl: values.MEND_WEB_URL,
    workerUrl: values.MEND_WORKER_URL,
    evidence: {
      adapter: values.MEND_EVIDENCE_ADAPTER as EvidenceAdapterKind,
      dir: values.MEND_EVIDENCE_DIR,
      maxBytes: values.MEND_EVIDENCE_MAX_BYTES,
      signedUrlTtlSeconds: values.MEND_EVIDENCE_URL_TTL_SECONDS,
      ...(signingSecret !== undefined ? { signingSecret } : {}),
    },
    features,
    mainnet,
  };
}
