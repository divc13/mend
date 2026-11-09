import { createHmac, timingSafeEqual } from 'node:crypto';
import { fixedClock, type TestClock } from './clock.js';

const DEFAULT_TOKEN_TTL_SECONDS = 300;
const KEY_PATTERN = /^[a-z0-9][a-z0-9/_.-]*$/;

export type EvidenceStoreErrorCode =
  | 'INVALID_KEY'
  | 'EMPTY_SECRET'
  | 'NOT_FOUND'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID';

export class EvidenceStoreError extends Error {
  readonly code: EvidenceStoreErrorCode;

  constructor(code: EvidenceStoreErrorCode, message: string) {
    super(message);
    this.name = 'EvidenceStoreError';
    this.code = code;
  }
}

export interface SignedEvidenceToken {
  key: string;
  expiresAt: number;
  token: string;
}

export interface InMemoryEvidenceStoreOptions {
  /** HMAC key used only by this fake. It never leaves the process. */
  secret?: string;
  clock?: TestClock;
}

function assertKey(key: string): void {
  if (!KEY_PATTERN.test(key) || key.includes('..') || key.startsWith('/')) {
    throw new EvidenceStoreError('INVALID_KEY', `invalid private evidence key: ${key}`);
  }
}

function cloneBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

/**
 * In-memory private evidence store with a signed, time-limited access token
 * interface. Reads through `readWithToken` require a valid HMAC token; the
 * deterministic fake clock controls expiry.
 *
 * This is a test double only. It has no encryption at rest and must never be
 * used for real private media.
 */
export class InMemoryEvidenceStore {
  readonly kind = 'memory' as const;
  readonly available = true;

  private readonly secret: string;
  private readonly clock: TestClock;
  private readonly objects = new Map<string, Uint8Array>();

  constructor(options: InMemoryEvidenceStoreOptions = {}) {
    const secret = options.secret ?? 'mend-testkit-evidence-secret-not-for-production';
    if (secret.trim() === '') {
      throw new EvidenceStoreError('EMPTY_SECRET', 'evidence signing secret must not be blank');
    }
    this.secret = secret;
    this.clock = options.clock ?? fixedClock();
  }

  put(key: string, bytes: string | Uint8Array): void {
    assertKey(key);
    const encoded = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : cloneBytes(bytes);
    this.objects.set(key, encoded);
  }

  get(key: string): Uint8Array {
    assertKey(key);
    const bytes = this.objects.get(key);
    if (!bytes) throw new EvidenceStoreError('NOT_FOUND', `private evidence object not found: ${key}`);
    return cloneBytes(bytes);
  }

  has(key: string): boolean {
    assertKey(key);
    return this.objects.has(key);
  }

  delete(key: string): boolean {
    assertKey(key);
    return this.objects.delete(key);
  }

  listKeys(): string[] {
    return [...this.objects.keys()].sort();
  }

  private signature(key: string, expiresAt: number): string {
    return createHmac('sha256', this.secret).update(`${key}|${expiresAt}`).digest('base64url');
  }

  /** Issues a signed token bound to one key and expiry instant. */
  signAccessToken(key: string, ttlSeconds = DEFAULT_TOKEN_TTL_SECONDS): SignedEvidenceToken {
    assertKey(key);
    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new EvidenceStoreError('TOKEN_INVALID', `token ttl must be a positive integer: ${String(ttlSeconds)}`);
    }
    const expiresAt = Math.floor(this.clock.now().getTime() / 1000) + ttlSeconds;
    return { key, expiresAt, token: this.signature(key, expiresAt) };
  }

  verifyAccessToken(token: SignedEvidenceToken): void {
    if (token.expiresAt * 1000 <= this.clock.now().getTime()) {
      throw new EvidenceStoreError('TOKEN_EXPIRED', 'evidence access token has expired');
    }
    const expected = Buffer.from(this.signature(token.key, token.expiresAt));
    const received = Buffer.from(token.token);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw new EvidenceStoreError('TOKEN_INVALID', 'invalid evidence access token');
    }
  }

  readWithToken(key: string, token: SignedEvidenceToken): Uint8Array {
    assertKey(key);
    if (token.key !== key) {
      throw new EvidenceStoreError('TOKEN_INVALID', 'evidence access token is bound to a different key');
    }
    this.verifyAccessToken(token);
    return this.get(key);
  }
}
