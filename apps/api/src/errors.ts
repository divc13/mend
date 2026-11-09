import { ERROR_HTTP_STATUS, MendError, type ErrorCode } from '@mend/protocol';
import { ZodError } from 'zod';

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function apiErrorBody(code: ErrorCode, message: string, details?: Record<string, unknown>): ApiErrorBody {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

export function validationError(error: ZodError): MendError {
  return new MendError('VALIDATION_ERROR', 'Request validation failed', {
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  });
}

export function notFound(message: string, details?: Record<string, unknown>): MendError {
  return new MendError('NOT_FOUND', message, details);
}

export interface NormalizedError {
  status: number;
  body: ApiErrorBody;
  internal: boolean;
}

/** Maps every error to the frozen protocol code + HTTP status table. */
export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof ZodError) {
    const mend = validationError(error);
    return {
      status: ERROR_HTTP_STATUS[mend.code],
      body: apiErrorBody(mend.code, mend.message, mend.details),
      internal: false,
    };
  }
  if (error instanceof MendError) {
    return {
      status: ERROR_HTTP_STATUS[error.code],
      body: apiErrorBody(error.code, error.message, error.details),
      internal: false,
    };
  }
  // Postgres constraint errors are translated into protocol-shaped errors.
  const pgCode = (error as { code?: string } | null)?.code;
  if (pgCode === '23505') {
    return {
      status: ERROR_HTTP_STATUS.VALIDATION_ERROR,
      body: apiErrorBody('VALIDATION_ERROR', 'Record already exists', { constraint: 'unique' }),
      internal: false,
    };
  }
  if (pgCode === '23503') {
    return {
      status: ERROR_HTTP_STATUS.INVALID_STATE,
      body: apiErrorBody('INVALID_STATE', 'Referenced record does not exist', { constraint: 'foreign_key' }),
      internal: false,
    };
  }
  if (pgCode === '23514') {
    return {
      status: ERROR_HTTP_STATUS.VALIDATION_ERROR,
      body: apiErrorBody('VALIDATION_ERROR', 'Database constraint rejected the record', { constraint: 'check' }),
      internal: false,
    };
  }
  // Fastify request parsing errors (malformed JSON, unsupported body type).
  const fastifyStatus = (error as { statusCode?: number } | null)?.statusCode;
  if (typeof fastifyStatus === 'number' && fastifyStatus >= 400 && fastifyStatus < 500) {
    return {
      status: ERROR_HTTP_STATUS.VALIDATION_ERROR,
      body: apiErrorBody('VALIDATION_ERROR', error instanceof Error ? error.message : 'Invalid request'),
      internal: false,
    };
  }
  return {
    status: 500,
    body: apiErrorBody('UPSTREAM_UNAVAILABLE', 'Internal error', {
      internal: true,
      reason: error instanceof Error ? error.message : String(error),
    }),
    internal: true,
  };
}
