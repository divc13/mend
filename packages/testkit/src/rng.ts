import { sha256Hex } from '@mend/protocol';

export interface DeterministicRng {
  /** Normalized 32-bit seed actually used. */
  readonly seed: number;
  /** Next float in [0, 1). Same seed and call order always produce the same value. */
  next(): number;
  /** Alias for `next()`, named for readability at call sites. */
  float(): number;
  /** Integer in [min, maxExclusive). */
  int(min: number, maxExclusive: number): number;
  /** Uniformly chooses an item from a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Returns a deterministically shuffled copy; the input is not mutated. */
  shuffle<T>(items: readonly T[]): T[];
  /** Lower-case hex string of the requested length. */
  hex(length: number): string;
}

function normalizeSeed(seed: number | string): number {
  if (typeof seed === 'number') {
    if (!Number.isSafeInteger(seed)) throw new Error(`RNG seed must be a safe integer: ${String(seed)}`);
    return seed >>> 0;
  }
  return Number.parseInt(sha256Hex(seed).slice(0, 8), 16) >>> 0;
}

/** Small, fast, deterministic PRNG (mulberry32). Not for cryptography. */
export function createRng(seed: number | string = 1): DeterministicRng {
  const normalized = normalizeSeed(seed);
  let state = normalized;

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  }

  return {
    seed: normalized,
    next,
    float: next,
    int(min: number, maxExclusive: number): number {
      if (!Number.isSafeInteger(min) || !Number.isSafeInteger(maxExclusive)) {
        throw new Error('RNG int bounds must be safe integers');
      }
      if (maxExclusive <= min) throw new Error(`RNG int requires max > min: ${min}..${maxExclusive}`);
      return min + Math.floor(next() * (maxExclusive - min));
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('RNG pick requires a non-empty array');
      const item = items[Math.floor(next() * items.length)];
      // Bounds are guaranteed by the [0, 1) float, but noUncheckedIndexedAccess
      // requires the assertion.
      return item as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = [...items];
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(next() * (index + 1));
        const current = copy[index] as T;
        copy[index] = copy[swapIndex] as T;
        copy[swapIndex] = current;
      }
      return copy;
    },
    hex(length: number): string {
      if (!Number.isSafeInteger(length) || length < 0) {
        throw new Error(`RNG hex length must be a non-negative integer: ${String(length)}`);
      }
      let output = '';
      while (output.length < length) {
        output += Math.floor(next() * 16).toString(16);
      }
      return output;
    },
  };
}
