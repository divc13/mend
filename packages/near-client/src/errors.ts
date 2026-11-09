export const NEAR_CLIENT_ERROR_CODES = [
  'INVALID_CONFIG',
  'MAINNET_NOT_ALLOWED',
  'LIVE_CALLS_DISABLED',
  'SIGNER_REQUIRED',
  'RPC_ERROR',
  'VIEW_FAILED',
  'UNEXPECTED_RESPONSE',
  'INVALID_ACCOUNT',
  'INVALID_PUBLIC_KEY',
  'KEY_NOT_ALLOWED',
  'NO_ONCHAIN_KEY',
  'PROMPT_INJECTION_BLOCKED',
  'CERTIFICATION_LANGUAGE',
] as const;

export type NearClientErrorCode = (typeof NEAR_CLIENT_ERROR_CODES)[number];

export class NearClientError extends Error {
  readonly code: NearClientErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: NearClientErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'NearClientError';
    this.code = code;
    this.details = details;
  }
}
