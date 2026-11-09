import { deflateSync, inflateSync } from 'node:zlib';

import { AiClientError } from './errors.js';
import { perceptualHashFromRgba } from './phash.js';

export type ImageFormat = 'png' | 'jpeg';

export interface ImageProcessingResult {
  bytes: Uint8Array;
  format: ImageFormat;
  removed: string[];
  metadataRemoved: boolean;
}

export interface RedactionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export { splitLocation, toPublicLocation } from './location.js';
export type { PreciseLocation, PublicLocation, SeparatedLocation } from './location.js';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_KEEP_CHUNKS = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS']);
const JPEG_DROP_MARKERS = new Map<number, string>([
  [0xe1, 'APP1/EXIF-XMP'],
  [0xed, 'APP13/IPTC'],
  [0xfe, 'COM'],
]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface PngChunk {
  type: string;
  data: Uint8Array;
}

function parsePngChunks(bytes: Uint8Array): PngChunk[] {
  const buffer = Buffer.from(bytes);
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new AiClientError('PRIVACY_INVALID_IMAGE', 'not a PNG image');
  }
  const chunks: PngChunk[] = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    if (offset + 12 + length > buffer.length) {
      throw new AiClientError('PRIVACY_INVALID_IMAGE', 'truncated PNG chunk');
    }
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = buffer.readUInt32BE(offset + 8 + length);
    const actualCrc = crc32(buffer.subarray(offset + 4, offset + 8 + length));
    if (expectedCrc !== actualCrc) {
      throw new AiClientError('PRIVACY_INVALID_IMAGE', `PNG chunk ${type} has an invalid CRC`);
    }
    chunks.push({ type, data });
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  return chunks;
}

function buildPngChunk(type: string, data: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, 'latin1');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, Buffer.from(data)])), 0);
  return Buffer.concat([length, typeBytes, Buffer.from(data), crc]);
}

function stripPngMetadata(bytes: Uint8Array): ImageProcessingResult {
  const chunks = parsePngChunks(bytes);
  const kept: Buffer[] = [];
  const removed: string[] = [];
  for (const chunk of chunks) {
    if (PNG_KEEP_CHUNKS.has(chunk.type)) {
      kept.push(buildPngChunk(chunk.type, chunk.data));
    } else {
      removed.push(chunk.type);
    }
  }
  return {
    bytes: Buffer.concat([PNG_SIGNATURE, ...kept]),
    format: 'png',
    removed,
    metadataRemoved: removed.length > 0,
  };
}

function stripJpegMetadata(bytes: Uint8Array): ImageProcessingResult {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new AiClientError('PRIVACY_INVALID_IMAGE', 'not a JPEG image');
  }
  const out: number[] = [0xff, 0xd8];
  const removed: string[] = [];
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const markerStart = offset;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    if (marker === undefined) break;
    offset += 1;

    if (marker === 0xd9) {
      out.push(0xff, 0xd9);
      break;
    }
    if (marker === 0xda) {
      for (const byte of bytes.subarray(markerStart)) out.push(byte);
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(0xff, marker);
      continue;
    }
    if (offset + 2 > bytes.length) {
      throw new AiClientError('PRIVACY_INVALID_IMAGE', 'truncated JPEG segment');
    }
    const length = (bytes[offset]! << 8) | bytes[offset + 1]!;
    const end = offset + length;
    if (length < 2 || end > bytes.length) {
      throw new AiClientError('PRIVACY_INVALID_IMAGE', 'invalid JPEG segment length');
    }
    const markerName = JPEG_DROP_MARKERS.get(marker);
    if (markerName) {
      removed.push(markerName);
    } else {
      for (const byte of bytes.subarray(markerStart, end)) out.push(byte);
    }
    offset = end;
  }
  return {
    bytes: Uint8Array.from(out),
    format: 'jpeg',
    removed,
    metadataRemoved: removed.length > 0,
  };
}

/** Remove EXIF/XMP/IPTC/comment metadata from JPEG and ancillary chunks from PNG. */
export function stripImageMetadata(bytes: Uint8Array): ImageProcessingResult {
  if (bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).equals(PNG_SIGNATURE)) {
    return stripPngMetadata(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return stripJpegMetadata(bytes);
  }
  throw new AiClientError(
    'PRIVACY_UNSUPPORTED_IMAGE',
    'unsupported image format; only PNG and JPEG metadata stripping is implemented',
  );
}

interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePngToRgba(bytes: Uint8Array): RgbaImage {
  const chunks = parsePngChunks(bytes);
  const ihdr = chunks[0];
  if (!ihdr || ihdr.type !== 'IHDR' || ihdr.data.length < 13) {
    throw new AiClientError('PRIVACY_INVALID_IMAGE', 'PNG is missing IHDR');
  }
  const view = Buffer.from(ihdr.data);
  const width = view.readUInt32BE(0);
  const height = view.readUInt32BE(4);
  const bitDepth = view[8];
  const colorType = view[9];
  const compression = view[10];
  const filterMethod = view[11];
  const interlace = view[12];
  if (
    width === 0 ||
    height === 0 ||
    bitDepth !== 8 ||
    compression !== 0 ||
    filterMethod !== 0 ||
    interlace !== 0
  ) {
    throw new AiClientError(
      'PRIVACY_UNSUPPORTED_IMAGE',
      'only 8-bit non-interlaced PNG images are supported for pixel operations',
    );
  }
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 4 ? 2 : colorType === 6 ? 4 : 0;
  if (channels === 0) {
    throw new AiClientError('PRIVACY_UNSUPPORTED_IMAGE', `unsupported PNG color type ${colorType}`);
  }

  const idat = Buffer.concat(
    chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => Buffer.from(chunk.data)),
  );
  let raw: Buffer;
  try {
    raw = inflateSync(idat);
  } catch {
    throw new AiClientError('PRIVACY_INVALID_IMAGE', 'PNG IDAT stream is invalid');
  }

  const rowBytes = width * channels;
  if (raw.length < height * (rowBytes + 1)) {
    throw new AiClientError('PRIVACY_INVALID_IMAGE', 'PNG pixel data is truncated');
  }

  const reconstructed = Buffer.alloc(height * rowBytes);
  let rawOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset]!;
    rawOffset += 1;
    const rowStart = y * rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const value = raw[rawOffset + x]!;
      const left = x >= channels ? reconstructed[rowStart + x - channels]! : 0;
      const up = y > 0 ? reconstructed[rowStart - rowBytes + x]! : 0;
      const upLeft = y > 0 && x >= channels ? reconstructed[rowStart - rowBytes + x - channels]! : 0;
      let result: number;
      switch (filter) {
        case 0:
          result = value;
          break;
        case 1:
          result = value + left;
          break;
        case 2:
          result = value + up;
          break;
        case 3:
          result = value + Math.floor((left + up) / 2);
          break;
        case 4:
          result = value + paeth(left, up, upLeft);
          break;
        default:
          throw new AiClientError('PRIVACY_INVALID_IMAGE', `unsupported PNG filter ${filter}`);
      }
      reconstructed[rowStart + x] = result & 0xff;
    }
    rawOffset += rowBytes;
  }

  const data = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const source = pixel * channels;
    const target = pixel * 4;
    if (colorType === 0) {
      const value = reconstructed[source]!;
      data[target] = value;
      data[target + 1] = value;
      data[target + 2] = value;
      data[target + 3] = 255;
    } else if (colorType === 4) {
      const value = reconstructed[source]!;
      data[target] = value;
      data[target + 1] = value;
      data[target + 2] = value;
      data[target + 3] = reconstructed[source + 1]!;
    } else if (colorType === 2) {
      data[target] = reconstructed[source]!;
      data[target + 1] = reconstructed[source + 1]!;
      data[target + 2] = reconstructed[source + 2]!;
      data[target + 3] = 255;
    } else {
      data[target] = reconstructed[source]!;
      data[target + 1] = reconstructed[source + 1]!;
      data[target + 2] = reconstructed[source + 2]!;
      data[target + 3] = reconstructed[source + 3]!;
    }
  }
  return { width, height, data };
}

function encodePngRgba(image: RgbaImage): Uint8Array {
  const rowBytes = image.width * 4;
  const raw = Buffer.alloc(image.height * (rowBytes + 1));
  for (let y = 0; y < image.height; y += 1) {
    const rowOffset = y * (rowBytes + 1);
    raw[rowOffset] = 0;
    Buffer.from(image.data.subarray(y * rowBytes, (y + 1) * rowBytes)).copy(raw, rowOffset + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    PNG_SIGNATURE,
    buildPngChunk('IHDR', ihdr),
    buildPngChunk('IDAT', deflateSync(raw, { level: 9 })),
    buildPngChunk('IEND', new Uint8Array()),
  ]);
}

/** Perceptual hash of a PNG. JPEG pixel decoding is intentionally not faked. */
export function perceptualHash(bytes: Uint8Array): string {
  if (!(bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).equals(PNG_SIGNATURE))) {
    throw new AiClientError(
      'PRIVACY_UNSUPPORTED_IMAGE',
      'byte-level perceptual hashing supports PNG only; decode other formats to RGBA in a trusted client first',
    );
  }
  const image = decodePngToRgba(bytes);
  return perceptualHashFromRgba(image.width, image.height, image.data);
}

/** Paint manual redaction boxes black on PNG pixels and strip all metadata. */
export function redactPng(bytes: Uint8Array, boxes: readonly RedactionBox[]): ImageProcessingResult {
  const image = decodePngToRgba(bytes);
  for (const box of boxes) {
    if (
      !Number.isInteger(box.x) ||
      !Number.isInteger(box.y) ||
      !Number.isInteger(box.width) ||
      !Number.isInteger(box.height) ||
      box.width <= 0 ||
      box.height <= 0
    ) {
      throw new AiClientError('PRIVACY_INVALID_IMAGE', 'redaction boxes must be positive integers');
    }
    const startX = Math.max(0, box.x);
    const startY = Math.max(0, box.y);
    const endX = Math.min(image.width, box.x + box.width);
    const endY = Math.min(image.height, box.y + box.height);
    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const offset = (y * image.width + x) * 4;
        image.data[offset] = 0;
        image.data[offset + 1] = 0;
        image.data[offset + 2] = 0;
        image.data[offset + 3] = 255;
      }
    }
  }
  return {
    bytes: encodePngRgba(image),
    format: 'png',
    removed: ['ancillary-metadata'],
    metadataRemoved: true,
  };
}


