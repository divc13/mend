import { loadConfig, type EnvLike } from './env.js';
import { assertServerOnly } from './secrets.js';
import type { MendConfig } from './types.js';

export * from './index.js';

/**
 * Server entry. Refuses to load secrets in a browser-like context. The check
 * runs when this function is called, not when the module is imported.
 */
export function loadServerConfig(env: EnvLike = process.env): MendConfig {
  assertServerOnly();
  return loadConfig(env);
}
