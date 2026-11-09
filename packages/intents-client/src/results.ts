import type { ExecutionStatusResponse, QuoteResponse, TokenResponse } from './schemas.js';

export interface TokensResult {
  tokens: TokenResponse[];
  /** Raw JSON exactly as returned by the API, retained for diagnostics. */
  raw: unknown;
}

export interface QuoteResult {
  response: QuoteResponse;
  /** Raw JSON exactly as returned by the API, used for signature verification. */
  raw: unknown;
  /** True only when the pinned Intents SDK verified the ed25519 signature. */
  verified: boolean;
}

export interface StatusResult {
  response: ExecutionStatusResponse;
  /** Raw JSON exactly as returned by the API, retained for diagnostics. */
  raw: unknown;
  /** True only when quoteResponse was present and its signature verified. */
  verified: boolean;
}
