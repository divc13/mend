import { keccak256 } from './keccak.js';

const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const GX = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
const GY = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;

interface Point {
  x: bigint;
  y: bigint;
}

function mod(value: bigint, modulus: bigint = P): bigint {
  const result = value % modulus;
  return result >= 0n ? result : result + modulus;
}

function powMod(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let value = mod(base, modulus);
  let power = exponent;
  while (power > 0n) {
    if ((power & 1n) === 1n) result = mod(result * value, modulus);
    value = mod(value * value, modulus);
    power >>= 1n;
  }
  return result;
}

function inverse(value: bigint, modulus: bigint = P): bigint {
  let t = 0n;
  let newT = 1n;
  let r = modulus;
  let newR = mod(value, modulus);
  if (newR === 0n) throw new Error('cannot invert zero');
  while (newR !== 0n) {
    const quotient = r / newR;
    [t, newT] = [newT, t - quotient * newT];
    [r, newR] = [newR, r - quotient * newR];
  }
  if (r !== 1n) throw new Error('value is not invertible');
  return mod(t, modulus);
}

function pointDouble(point: Point | null): Point | null {
  if (point === null) return null;
  if (point.y === 0n) return null;
  const slope = mod(3n * point.x * point.x * inverse(2n * point.y));
  const x = mod(slope * slope - 2n * point.x);
  const y = mod(slope * (point.x - x) - point.y);
  return { x, y };
}

function pointAdd(left: Point | null, right: Point | null): Point | null {
  if (left === null) return right;
  if (right === null) return left;
  if (left.x === right.x && mod(left.y + right.y) === 0n) return null;
  if (left.x === right.x && left.y === right.y) return pointDouble(left);
  const slope = mod((right.y - left.y) * inverse(right.x - left.x));
  const x = mod(slope * slope - left.x - right.x);
  const y = mod(slope * (left.x - x) - left.y);
  return { x, y };
}

function scalarMultiply(scalar: bigint, point: Point): Point | null {
  let result: Point | null = null;
  let addend: Point | null = point;
  let remaining = mod(scalar, N);
  while (remaining > 0n) {
    if ((remaining & 1n) === 1n) result = pointAdd(result, addend);
    addend = pointDouble(addend);
    remaining >>= 1n;
  }
  return result;
}

function decompress(x: bigint, odd: boolean): Point {
  if (x <= 0n || x >= P) throw new Error('invalid x coordinate');
  const alpha = mod(x * x * x + 7n);
  let y = powMod(alpha, (P + 1n) / 4n, P);
  if (mod(y * y) !== alpha) throw new Error('x is not on secp256k1');
  if (((y & 1n) === 1n) !== odd) y = P - y;
  return { x, y };
}

function bigIntFromBytes(bytes: Uint8Array): bigint {
  return BigInt(`0x${Buffer.from(bytes).toString('hex')}`);
}

function bytes32(value: bigint): Uint8Array {
  const hex = value.toString(16).padStart(64, '0');
  return Buffer.from(hex, 'hex');
}

function parseHex(value: string): Uint8Array {
  const clean = value.startsWith('0x') || value.startsWith('0X') ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error('invalid hex');
  }
  return Buffer.from(clean, 'hex');
}

export interface EcdsaSignatureParts {
  r: bigint;
  s: bigint;
  recovery: number;
}

export function parseEcdsaSignature(signatureHex: string): EcdsaSignatureParts {
  const bytes = parseHex(signatureHex);
  if (bytes.length !== 65) throw new Error('expected a 65-byte r||s||v signature');
  const r = bigIntFromBytes(bytes.subarray(0, 32));
  const s = bigIntFromBytes(bytes.subarray(32, 64));
  const rawV = bytes[64]!;
  const recovery = rawV >= 27 ? rawV - 27 : rawV;
  if (recovery !== 0 && recovery !== 1) throw new Error('unsupported recovery id');
  if (r <= 0n || r >= N || s <= 0n || s >= N) throw new Error('signature scalar out of range');
  return { r, s, recovery };
}

/** EIP-191 personal-message digest. */
export function eip191Digest(text: string): Uint8Array {
  const payload = Buffer.from(text, 'utf8');
  const prefix = Buffer.from(`\u0019Ethereum Signed Message:\n${payload.length}`, 'utf8');
  return keccak256(Buffer.concat([prefix, payload]));
}

/** Recover an uncompressed 64-byte public key from an ECDSA digest/signature. */
export function recoverPublicKeyFromDigest(
  digest: Uint8Array,
  signatureHex: string,
): Uint8Array {
  if (digest.length !== 32) throw new Error('expected a 32-byte digest');
  const { r, s, recovery } = parseEcdsaSignature(signatureHex);
  const e = mod(bigIntFromBytes(digest), N);
  const point = decompress(r, (recovery & 1) === 1);
  const rInverse = inverse(r, N);
  const numerator = pointAdd(
    scalarMultiply(s, point),
    scalarMultiply(mod(-e, N), { x: GX, y: GY }),
  );
  if (numerator === null) throw new Error('recovered point is infinity');
  const publicKey = scalarMultiply(rInverse, numerator);
  if (publicKey === null) throw new Error('recovered public key is infinity');
  return Buffer.concat([bytes32(publicKey.x), bytes32(publicKey.y)]);
}

export function recoverPublicKey(text: string, signatureHex: string): Uint8Array {
  return recoverPublicKeyFromDigest(eip191Digest(text), signatureHex);
}

export function ethereumAddressFromPublicKey(publicKey: Uint8Array): string {
  if (publicKey.length !== 64) throw new Error('expected uncompressed public key without 0x04');
  const digest = keccak256(publicKey);
  return Buffer.from(digest.subarray(12)).toString('hex');
}

export function ethereumAddressForSignature(text: string, signatureHex: string): string {
  return ethereumAddressFromPublicKey(recoverPublicKey(text, signatureHex));
}

export function verifyEcdsaDigest(
  digest: Uint8Array,
  signatureHex: string,
  expectedAddress: string,
): boolean {
  try {
    const expected = expectedAddress.replace(/^0x/i, '').toLowerCase();
    if (!/^[0-9a-f]{40}$/.test(expected)) return false;
    return ethereumAddressFromPublicKey(recoverPublicKeyFromDigest(digest, signatureHex)) === expected;
  } catch {
    return false;
  }
}

export function verifyEcdsaEip191(text: string, signatureHex: string, expectedAddress: string): boolean {
  return verifyEcdsaDigest(eip191Digest(text), signatureHex, expectedAddress);
}
