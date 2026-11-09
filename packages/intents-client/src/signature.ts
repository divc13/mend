import { verifyQuoteSignature as sdkVerifyQuoteSignature } from '@defuse-protocol/one-click-sdk-typescript';

/**
 * Verify a signed 1Click quote with the pinned Intents SDK (0.1.26).
 * The SDK pins manager public key:
 *   ed25519:reYaWhvwu8Jzo3WUM3zhn6VrhuMEF4eADL17qtRVifc
 *
 * Always pass the raw response object (not a zod-stripped copy) so the exact
 * signed payload is preserved. Returns false for tampered or malformed input;
 * callers must reject the quote.
 */
export function verifySignedQuote(raw: unknown): boolean {
  if (raw === null || typeof raw !== 'object') return false;
  try {
    return sdkVerifyQuoteSignature(raw as Parameters<typeof sdkVerifyQuoteSignature>[0]);
  } catch {
    return false;
  }
}
