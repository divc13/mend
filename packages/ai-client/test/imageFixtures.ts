import { deflateSync } from 'node:zlib';

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
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, 'latin1');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, Buffer.from(data)])), 0);
  return Buffer.concat([length, typeBytes, Buffer.from(data), crc]);
}

/** Build a deterministic 8-bit RGBA PNG with optional extra chunks. */
export function makePng(
  width: number,
  height: number,
  rgba: Uint8Array,
  extraChunks: ReadonlyArray<[string, Uint8Array]> = [],
): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowBytes = width * 4;
  const raw = Buffer.alloc(height * (rowBytes + 1));
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (rowBytes + 1);
    raw[rowOffset] = 0;
    Buffer.from(rgba.subarray(y * rowBytes, (y + 1) * rowBytes)).copy(raw, rowOffset + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...extraChunks.map(([type, data]) => chunk(type, data)),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array()),
  ]);
}

export function gradientRgba(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      data[offset] = x * 17;
      data[offset + 1] = y * 23;
      data[offset + 2] = (x + y) * 11;
      data[offset + 3] = 255;
    }
  }
  return data;
}

/** Minimal structurally valid JPEG with EXIF/APP1 and COM metadata. */
export function makeJpegWithMetadata(): Buffer {
  const segment = (marker: number, payload: Buffer): Buffer => {
    const length = Buffer.alloc(2);
    length.writeUInt16BE(payload.length + 2, 0);
    return Buffer.concat([Buffer.from([0xff, marker]), length, payload]);
  };
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xe0, Buffer.from('JFIF\0\x01\x02\0\0\x01\0\x01\0\0', 'latin1')),
    segment(0xe1, Buffer.from('Exif\0\0GPSLatitude=52.5200123;Camera=SecretCamera', 'latin1')),
    segment(0xfe, Buffer.from('secret-comment: private location', 'latin1')),
    segment(0xda, Buffer.from([1, 1, 0, 0, 0, 0, 0, 0, 0, 0])),
    Buffer.from([0x11, 0x22, 0x33, 0x44, 0xff, 0xd9]),
  ]);
}
