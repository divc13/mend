const MASK = (1n << 64n) - 1n;

const ROUND_CONSTANTS: readonly bigint[] = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

const ROTATIONS: readonly number[] = [
  0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14,
];

function rotateLeft(value: bigint, bits: number): bigint {
  if (bits === 0) return value & MASK;
  const amount = BigInt(bits);
  return ((value << amount) | (value >> (64n - amount))) & MASK;
}

function keccakF1600(state: bigint[]): void {
  const c = new Array<bigint>(5);
  const b = new Array<bigint>(25);

  for (let round = 0; round < 24; round += 1) {
    for (let x = 0; x < 5; x += 1) {
      c[x] = state[x]! ^ state[x + 5]! ^ state[x + 10]! ^ state[x + 15]! ^ state[x + 20]!;
    }
    for (let x = 0; x < 5; x += 1) {
      const d = c[(x + 4) % 5]! ^ rotateLeft(c[(x + 1) % 5]!, 1);
      for (let y = 0; y < 5; y += 1) {
        state[x + 5 * y] = state[x + 5 * y]! ^ d;
      }
    }

    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        b[y + 5 * ((2 * x + 3 * y) % 5)] = rotateLeft(state[x + 5 * y]!, ROTATIONS[x + 5 * y]!);
      }
    }

    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        state[x + 5 * y] =
          b[x + 5 * y]! ^ ((~b[((x + 1) % 5) + 5 * y]! & MASK) & b[((x + 2) % 5) + 5 * y]!);
      }
    }

    state[0] = state[0]! ^ ROUND_CONSTANTS[round]!;
  }
}

function readLane(bytes: Uint8Array, offset: number): bigint {
  let lane = 0n;
  for (let index = 0; index < 8; index += 1) {
    lane |= BigInt(bytes[offset + index]!) << BigInt(8 * index);
  }
  return lane;
}

function writeLane(lane: bigint, out: Uint8Array, offset: number): void {
  let value = lane;
  for (let index = 0; index < 8; index += 1) {
    out[offset + index] = Number(value & 0xffn);
    value >>= 8n;
  }
}

/** Ethereum Keccak-256 (original Keccak padding, not NIST SHA3-256). */
export function keccak256(data: Uint8Array): Uint8Array {
  const rate = 136;
  const state = new Array<bigint>(25).fill(0n);
  let offset = 0;

  while (offset + rate <= data.length) {
    for (let lane = 0; lane < rate / 8; lane += 1) {
      state[lane] = state[lane]! ^ readLane(data, offset + lane * 8);
    }
    keccakF1600(state);
    offset += rate;
  }

  const finalBlock = new Uint8Array(rate);
  finalBlock.set(data.subarray(offset));
  finalBlock[data.length - offset] = (finalBlock[data.length - offset] ?? 0) ^ 0x01;
  finalBlock[rate - 1] = (finalBlock[rate - 1] ?? 0) ^ 0x80;
  for (let lane = 0; lane < rate / 8; lane += 1) {
    state[lane] = state[lane]! ^ readLane(finalBlock, lane * 8);
  }
  keccakF1600(state);

  const out = new Uint8Array(32);
  for (let lane = 0; lane < 4; lane += 1) {
    writeLane(state[lane]!, out, lane * 8);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}
