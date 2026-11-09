/**
 * Browser-safe shared entry: no network client, no server credentials.
 *
 * `nearAiClient` lives only in `@mend/ai-client/server`.
 */
export * from './errors.js';
export * from './types.js';
export * from './location.js';
export * from './duplicateEngine.js';
export * from './promptGuard.js';
export { perceptualHashFromRgba } from './phash.js';
