export type AiClientErrorCode =
  | 'NEAR_AI_CONFIG'
  | 'NEAR_AI_UNAVAILABLE'
  | 'NEAR_AI_INVALID_OUTPUT'
  | 'NEAR_AI_HTTP_ERROR'
  | 'PRIVACY_UNSUPPORTED_IMAGE'
  | 'PRIVACY_INVALID_IMAGE'
  | 'LOCATION_INVALID'
  | 'PROMPT_INJECTION_REJECTED'
  | 'VERIFICATION_UNAVAILABLE'
  | 'VERIFICATION_FAILED'
  | 'SCOPE_UNSUPPORTED'
  | 'EVIDENCE_CERTIFICATION_LANGUAGE';

export class AiClientError extends Error {
  readonly code: AiClientErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: AiClientErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AiClientError';
    this.code = code;
    this.details = details;
  }
}
