export type IntentsErrorCode =
  | 'INTENTS_HTTP_ERROR'
  | 'INTENTS_NETWORK_ERROR'
  | 'INTENTS_TIMEOUT'
  | 'INTENTS_SCHEMA_ERROR'
  | 'INTENTS_SIGNATURE_INVALID'
  | 'INTENTS_NOT_FOUND'
  | 'INTENTS_RATE_LIMITED'
  | 'INTENTS_POLL_TIMEOUT'
  | 'INVALID_QUOTE_REQUEST'
  | 'MAINNET_GUARD_BLOCKED'
  | 'NEAR_RECIPIENT_NOT_READY';

export class IntentsError extends Error {
  readonly code: IntentsErrorCode;

  constructor(code: IntentsErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'IntentsError';
    this.code = code;
  }
}

export class IntentsApiError extends IntentsError {
  readonly status: number;
  readonly path: string;
  /** Validated error body when available; raw text otherwise. Never headers. */
  readonly body: unknown;

  constructor(status: number, path: string, body: unknown, message?: string) {
    super(status === 404 ? 'INTENTS_NOT_FOUND' : status === 429 ? 'INTENTS_RATE_LIMITED' : 'INTENTS_HTTP_ERROR', message ?? `1Click API ${status} for ${path}`);
    this.name = 'IntentsApiError';
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

export class IntentsNetworkError extends IntentsError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('INTENTS_NETWORK_ERROR', message, options);
    this.name = 'IntentsNetworkError';
  }
}

export class IntentsTimeoutError extends IntentsError {
  constructor(message: string) {
    super('INTENTS_TIMEOUT', message);
    this.name = 'IntentsTimeoutError';
  }
}

export class IntentsSchemaError extends IntentsError {
  readonly issues: unknown;

  constructor(path: string, issues: unknown) {
    super('INTENTS_SCHEMA_ERROR', `1Click response failed schema validation for ${path}`);
    this.name = 'IntentsSchemaError';
    this.issues = issues;
  }
}

export class QuoteSignatureError extends IntentsError {
  constructor(message = 'quote signature verification failed') {
    super('INTENTS_SIGNATURE_INVALID', message);
    this.name = 'QuoteSignatureError';
  }
}

export class InvalidQuoteRequestError extends IntentsError {
  readonly issues: unknown;

  constructor(issues: unknown) {
    super('INVALID_QUOTE_REQUEST', 'quote request failed schema validation');
    this.name = 'InvalidQuoteRequestError';
    this.issues = issues;
  }
}

export class MainnetGuardError extends IntentsError {
  readonly missing: readonly ('MEND_ALLOW_MAINNET' | 'confirmMainnet')[];

  constructor(missing: readonly ('MEND_ALLOW_MAINNET' | 'confirmMainnet')[]) {
    super(
      'MAINNET_GUARD_BLOCKED',
      'MAINNET ONLY — refusing non-dry Intents execution. Set MEND_ALLOW_MAINNET=true and pass confirmMainnet:true explicitly.',
    );
    this.name = 'MainnetGuardError';
    this.missing = missing;
  }
}

export class NearRecipientCheckError extends IntentsError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('NEAR_RECIPIENT_NOT_READY', message, options);
    this.name = 'NearRecipientCheckError';
  }
}
