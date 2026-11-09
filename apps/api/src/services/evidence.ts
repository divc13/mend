import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MendError, sha256Hex } from '@mend/protocol';
import type { AppConfig } from '../config.js';

export interface PrivateEvidenceStore {
  readonly kind: 'local' | 's3' | 'unavailable';
  readonly available: boolean;
  readonly unavailableReason?: string;
  put(key: string, bytes: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const KEY_PATTERN = /^[a-z0-9][a-z0-9/_.-]*$/;

function assertKey(key: string): void {
  if (!KEY_PATTERN.test(key) || key.includes('..') || key.startsWith('/')) {
    throw new MendError('VALIDATION_ERROR', 'Invalid private storage key');
  }
}

/**
 * Private local-disk adapter. The directory must be outside any public static
 * root. Bytes are never served by a static file server: every read goes through
 * the signed-URL route in the API.
 */
export class LocalDiskEvidenceStore implements PrivateEvidenceStore {
  readonly kind = 'local' as const;
  readonly available = true;

  constructor(private readonly baseDir: string) {}

  private resolve(key: string): string {
    assertKey(key);
    const target = path.resolve(this.baseDir, key);
    const root = path.resolve(this.baseDir);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      throw new MendError('VALIDATION_ERROR', 'Invalid private storage key');
    }
    return target;
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { mode: 0o600 });
  }

  async get(key: string): Promise<Buffer> {
    try {
      return await readFile(this.resolve(key));
    } catch {
      throw new MendError('NOT_FOUND', 'Private evidence object is unavailable');
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

/**
 * S3-compatible interface placeholder. The shape matches the local adapter, but
 * it is not activated in this wave: no credentials are committed and pretending
 * a bucket exists would be dishonest. Selecting it without a complete
 * configuration returns an explicit unavailable state.
 */
export class S3CompatibleEvidenceStore implements PrivateEvidenceStore {
  readonly kind = 's3' as const;
  readonly available = false;
  readonly unavailableReason: string;

  constructor(config: AppConfig['evidence']['s3']) {
    const missing = [
      config?.endpoint ? undefined : 'S3_ENDPOINT',
      config?.bucket ? undefined : 'S3_BUCKET',
      config?.accessKeyId ? undefined : 'S3_ACCESS_KEY_ID',
      config?.secretAccessKey ? undefined : 'S3_SECRET_ACCESS_KEY',
    ].filter((value): value is string => Boolean(value));
    this.unavailableReason = missing.length
      ? `S3-compatible adapter is not configured (missing ${missing.join(', ')})`
      : 'S3-compatible adapter interface is defined but not activated in this wave; use the private local adapter or complete the adapter task.';
  }

  put(): Promise<void> {
    return Promise.reject(new MendError('UPSTREAM_UNAVAILABLE', this.unavailableReason, { adapter: 's3' }));
  }

  get(): Promise<Buffer> {
    return Promise.reject(new MendError('UPSTREAM_UNAVAILABLE', this.unavailableReason, { adapter: 's3' }));
  }

  delete(): Promise<void> {
    return Promise.reject(new MendError('UPSTREAM_UNAVAILABLE', this.unavailableReason, { adapter: 's3' }));
  }
}

export function createEvidenceStore(config: AppConfig['evidence']): PrivateEvidenceStore {
  if (config.adapter === 's3') return new S3CompatibleEvidenceStore(config.s3);
  if (config.adapter === 'unavailable') {
    return new S3CompatibleEvidenceStore(undefined);
  }
  return new LocalDiskEvidenceStore(config.dir);
}

export const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);

function stripJpeg(bytes: Buffer): { bytes: Buffer; stripped: boolean } {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new MendError('VALIDATION_ERROR', 'Invalid JPEG data');
  }
  const chunks: Buffer[] = [bytes.subarray(0, 2)];
  let offset = 2;
  let stripped = false;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      throw new MendError('VALIDATION_ERROR', 'Malformed JPEG segment');
    }
    let markerOffset = offset;
    while (markerOffset < bytes.length && bytes[markerOffset] === 0xff) markerOffset += 1;
    if (markerOffset >= bytes.length) break;
    const marker = bytes[markerOffset]!;
    offset = markerOffset + 1;

    if (marker === 0xda || marker === 0xd9) {
      chunks.push(bytes.subarray(markerOffset - 1));
      break;
    }
    // Standalone markers without a length field.
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      chunks.push(bytes.subarray(markerOffset - 1, offset));
      continue;
    }
    if (offset + 2 > bytes.length) throw new MendError('VALIDATION_ERROR', 'Truncated JPEG segment');
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) {
      throw new MendError('VALIDATION_ERROR', 'Malformed JPEG segment length');
    }
    const segment = bytes.subarray(markerOffset - 1, offset + length);
    const isExif = marker === 0xe1 && bytes.subarray(offset + 2, offset + 8).toString('latin1') === 'Exif\0\0';
    const isXmp = marker === 0xe1 && bytes.subarray(offset + 2, offset + 31).toString('latin1').startsWith('http://ns.adobe.com/xap/1.0/');
    if (isExif || isXmp) {
      stripped = true;
    } else {
      chunks.push(segment);
    }
    offset += length;
  }
  return { bytes: Buffer.concat(chunks), stripped };
}

function stripPng(bytes: Buffer): { bytes: Buffer; stripped: boolean } {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(signature)) {
    throw new MendError('VALIDATION_ERROR', 'Invalid PNG data');
  }
  const chunks: Buffer[] = [bytes.subarray(0, 8)];
  let offset = 8;
  let stripped = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new MendError('VALIDATION_ERROR', 'Malformed PNG chunk');
    const type = bytes.subarray(offset + 4, offset + 8).toString('latin1');
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const metadata = type === 'eXIf'
      || (type === 'tEXt' && data.toString('latin1').startsWith('XML:com.adobe.xmp'))
      || (type === 'iTXt' && data.toString('latin1').startsWith('XML:com.adobe.xmp'));
    if (metadata) {
      stripped = true;
    } else {
      chunks.push(bytes.subarray(offset, end));
    }
    offset = end;
  }
  if (offset !== bytes.length) throw new MendError('VALIDATION_ERROR', 'Malformed PNG trailer');
  return { bytes: Buffer.concat(chunks), stripped };
}

/**
 * Removes EXIF/XMP metadata before hashing or storing. The returned hash is the
 * hash of the stripped bytes — never the original upload — so the on-chain
 * reference cannot leak location metadata.
 */
export function stripImageMetadata(input: Buffer, contentType: string): { bytes: Buffer; stripped: boolean; sha256: string } {
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new MendError('VALIDATION_ERROR', 'Only image/jpeg and image/png are accepted', { contentType });
  }
  const result = contentType === 'image/jpeg' ? stripJpeg(input) : stripPng(input);
  return { ...result, sha256: sha256Hex(result.bytes) };
}

export function decodeBase64Image(dataBase64: string, maxBytes: number): Buffer {
  const trimmed = dataBase64.replace(/^data:[^;]+;base64,/, '');
  if (!/^[A-Za-z0-9+/=\s_-]+$/.test(trimmed)) {
    throw new MendError('VALIDATION_ERROR', 'Invalid base64 image payload');
  }
  const bytes = Buffer.from(trimmed, 'base64');
  if (bytes.length === 0) throw new MendError('VALIDATION_ERROR', 'Empty image payload');
  if (bytes.length > maxBytes) {
    throw new MendError('VALIDATION_ERROR', 'Image exceeds the configured size limit', { maxBytes, sizeBytes: bytes.length });
  }
  return bytes;
}

export function signEvidenceAccess(input: {
  secret: string;
  evidenceId: string;
  objectId: string;
  storageKey: string;
  expiresAt: number;
}): string {
  return createHmac('sha256', input.secret)
    .update(`${input.evidenceId}|${input.objectId}|${input.storageKey}|${input.expiresAt}`)
    .digest('base64url');
}

export function verifyEvidenceAccess(input: {
  secret: string;
  evidenceId: string;
  objectId: string;
  storageKey: string;
  expiresAt: number;
  token: string;
  now?: Date;
}): void {
  const nowMs = (input.now ?? new Date()).getTime();
  if (!Number.isFinite(input.expiresAt) || input.expiresAt * 1000 < nowMs) {
    throw new MendError('UNAUTHORIZED', 'Evidence access link has expired');
  }
  const expected = signEvidenceAccess(input);
  const received = input.token;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new MendError('UNAUTHORIZED', 'Invalid evidence access token');
  }
}

export function evidenceAccessUrl(config: AppConfig, evidenceId: string, objectId: string, expiresAt: number, token: string): string {
  const query = new URLSearchParams({
    objectId,
    expires: String(expiresAt),
    token,
  });
  return `${config.publicBaseUrl}/v1/evidence/${encodeURIComponent(evidenceId)}/download?${query.toString()}`;
}
