import { AiClientError } from './errors.js';

/** Deterministic 64-bit dHash from RGBA pixels. */
export function perceptualHashFromRgba(width: number, height: number, rgba: Uint8Array): string {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) {
    throw new AiClientError('PRIVACY_INVALID_IMAGE', 'invalid RGBA buffer for perceptual hash');
  }
  const luminance = new Array<number>(9 * 8);
  for (let y = 0; y < 8; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor(((y + 0.5) * height) / 8));
    for (let x = 0; x < 9; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor(((x + 0.5) * width) / 9));
      const offset = (sourceY * width + sourceX) * 4;
      const r = rgba[offset]!;
      const g = rgba[offset + 1]!;
      const b = rgba[offset + 2]!;
      luminance[y * 9 + x] = Math.floor((299 * r + 587 * g + 114 * b) / 1000);
    }
  }
  let hash = 0n;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      hash <<= 1n;
      if (luminance[y * 9 + x]! > luminance[y * 9 + x + 1]!) hash |= 1n;
    }
  }
  return hash.toString(16).padStart(16, '0');
}
