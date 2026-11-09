import { AiClientError } from './errors.js';

export const DEFAULT_NEAR_AI_BASE_URL = 'https://cloud-api.near.ai/v1';
export const DEFAULT_NEAR_AI_MODEL = 'z-ai/glm-5.3-flash';

export interface NearAiConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
  timeoutMs: number;
}

export interface PublicNearAiConfig {
  baseUrl: string;
  model: string;
  apiKeyConfigured: boolean;
  timeoutMs: number;
}

/** Server-side guard: this module must never be reachable from a browser bundle. */
export function assertServerRuntime(): void {
  const hasBrowserWindow =
    typeof globalThis === 'object' &&
    (globalThis as { window?: unknown }).window !== undefined;
  if (hasBrowserWindow || typeof process === 'undefined' || !process.versions?.node) {
    throw new AiClientError(
      'NEAR_AI_CONFIG',
      'NEAR AI client is server-side only; use the browser-safe entry for client code',
    );
  }
}

export function loadNearAiConfig(env: NodeJS.ProcessEnv = process.env): NearAiConfig {
  const rawBase = env.NEAR_AI_BASE_URL?.trim() || DEFAULT_NEAR_AI_BASE_URL;
  const baseUrl = rawBase.replace(/\/+$/, '');
  if (!/^https:\/\//.test(baseUrl)) {
    throw new AiClientError('NEAR_AI_CONFIG', 'NEAR_AI_BASE_URL must be an https URL');
  }
  const timeout = Number(env.NEAR_AI_TIMEOUT_MS ?? 30_000);
  if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 120_000) {
    throw new AiClientError('NEAR_AI_CONFIG', 'NEAR_AI_TIMEOUT_MS must be 1000..120000');
  }
  const apiKey = env.NEAR_AI_API_KEY?.trim() || undefined;
  const model = env.NEAR_AI_MODEL?.trim() || DEFAULT_NEAR_AI_MODEL;
  if (!/^[A-Za-z0-9._/-]+$/.test(model)) {
    throw new AiClientError('NEAR_AI_CONFIG', 'NEAR_AI_MODEL contains invalid characters');
  }
  return { baseUrl, apiKey, model, timeoutMs: timeout };
}

/** Safe representation for logs/UI. Never includes the key. */
export function publicNearAiConfig(config: NearAiConfig): PublicNearAiConfig {
  return {
    baseUrl: config.baseUrl,
    model: config.model,
    apiKeyConfigured: Boolean(config.apiKey),
    timeoutMs: config.timeoutMs,
  };
}
