import { describe, expect, it } from 'vitest';

import { perceptualHashFromRgba } from '../src/index.js';
import { splitLocation, toPublicLocation } from '../src/location.js';
import {
  perceptualHash,
  redactPng,
  stripImageMetadata,
} from '../src/privacy.js';
import { gradientRgba, makeJpegWithMetadata, makePng } from './imageFixtures.js';

function text(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('latin1');
}

describe('privacy: metadata stripping', () => {
  it('removes PNG tEXt/eXIf metadata while preserving pixels and hash', () => {
    const png = makePng(24, 16, gradientRgba(24, 16), [
      ['tEXt', Buffer.from('Camera=SecretCamera GPS=52.5200123,13.4049876', 'latin1')],
      ['eXIf', Buffer.from('private-exif-payload', 'latin1')],
      ['tIME', Buffer.from([7, 232, 1, 1, 0, 0, 0])],
    ]);

    expect(text(png)).toContain('SecretCamera');
    const result = stripImageMetadata(png);
    expect(result.format).toBe('png');
    expect(result.metadataRemoved).toBe(true);
    expect(result.removed).toEqual(expect.arrayContaining(['tEXt', 'eXIf', 'tIME']));

    const cleaned = text(result.bytes);
    expect(cleaned).not.toContain('SecretCamera');
    expect(cleaned).not.toContain('private-exif-payload');
    expect(cleaned).not.toContain('tEXt');
    expect(cleaned).not.toContain('eXIf');

    expect(perceptualHash(png)).toBe(perceptualHash(result.bytes));
  });

  it('removes JPEG APP1 EXIF and COM metadata', () => {
    const jpeg = makeJpegWithMetadata();
    expect(text(jpeg)).toContain('SecretCamera');
    expect(text(jpeg)).toContain('GPSLatitude');

    const result = stripImageMetadata(jpeg);
    expect(result.format).toBe('jpeg');
    expect(result.removed).toEqual(expect.arrayContaining(['APP1/EXIF-XMP', 'COM']));
    const cleaned = text(result.bytes);
    expect(cleaned).not.toContain('SecretCamera');
    expect(cleaned).not.toContain('GPSLatitude');
    expect(cleaned).not.toContain('secret-comment');
    expect(result.bytes[0]).toBe(0xff);
    expect(result.bytes[1]).toBe(0xd8);
  });

  it('rejects unsupported or corrupt images instead of silently passing them', () => {
    expect(() => stripImageMetadata(Buffer.from('GIF89a-not-supported'))).toThrow(/unsupported/);
    const png = makePng(4, 4, gradientRgba(4, 4));
    const corrupt = Uint8Array.from(png);
    corrupt[corrupt.length - 1] = (corrupt[corrupt.length - 1] ?? 0) ^ 0xff;
    expect(() => stripImageMetadata(corrupt)).toThrow(/CRC/);
  });
});

describe('privacy: perceptual hash and manual redaction', () => {
  it('produces a stable deterministic perceptual hash', () => {
    const png = makePng(32, 24, gradientRgba(32, 24));
    const once = perceptualHash(png);
    expect(once).toMatch(/^[0-9a-f]{16}$/);
    expect(perceptualHash(png)).toBe(once);
    expect(perceptualHashFromRgba(32, 24, gradientRgba(32, 24))).toBe(once);
  });

  it('paints manual redaction boxes and drops metadata', () => {
    const png = makePng(16, 16, gradientRgba(16, 16), [
      ['tEXt', Buffer.from('Camera=SecretCamera', 'latin1')],
    ]);
    const originalHash = perceptualHash(png);
    const result = redactPng(png, [{ x: 0, y: 0, width: 16, height: 16 }]);
    expect(result.metadataRemoved).toBe(true);
    expect(text(result.bytes)).not.toContain('SecretCamera');
    expect(text(result.bytes)).not.toContain('tEXt');
    expect(perceptualHash(result.bytes)).not.toBe(originalHash);
    expect(perceptualHash(result.bytes)).toBe(perceptualHash(result.bytes));
  });

  it('does not pretend to hash JPEG bytes without decoding', () => {
    expect(() => perceptualHash(makeJpegWithMetadata())).toThrow(/PNG only/);
  });
});

describe('privacy: coarse versus precise location', () => {
  it('keeps precise coordinates out of the public object', () => {
    const separated = splitLocation({
      lat: 52.5200123,
      lng: 13.4049876,
      accuracyM: 5,
      label: 'Riverside Park east gate',
      area: 'Riverside Park',
    });
    expect(separated.publicLocation).toEqual({
      label: 'Riverside Park east gate',
      coarseLat: 52.52,
      coarseLng: 13.4,
      area: 'Riverside Park',
    });
    expect('lat' in separated.publicLocation).toBe(false);
    expect('lng' in separated.publicLocation).toBe(false);
    expect(JSON.stringify(separated.publicLocation)).not.toContain('52.5200123');
    expect(separated.privateLocation).toEqual({ lat: 52.5200123, lng: 13.4049876, accuracyM: 5 });
  });

  it('validates coordinates and precision', () => {
    expect(() => toPublicLocation({ lat: 100, lng: 13 })).toThrow(/latitude/);
    expect(() => toPublicLocation({ lat: 52, lng: 200 })).toThrow(/longitude/);
    expect(() => toPublicLocation({ lat: 52, lng: 13 }, 0)).toThrow(/precision/);
  });
});
