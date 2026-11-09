export interface IdSequenceOptions {
  /** First numeric value emitted. Defaults to 1. */
  start?: number;
  /** Zero-padding width. Defaults to 4. */
  width?: number;
}

export interface IdSequence {
  readonly prefix: string;
  readonly width: number;
  /** Emits the next identifier and advances the sequence. */
  next(): string;
  /** Shows the next identifier without advancing. */
  peek(): string;
  /** Last numeric value emitted, or `start - 1` before the first call. */
  current(): number;
  /** Returns to the configured start value. */
  reset(): void;
}

function assertInteger(name: string, value: number, min: number, max: number): void {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}: ${String(value)}`);
  }
}

/**
 * Deterministic identifier sequence, e.g. `idSequence('CMD-').next() === 'CMD-0001'`.
 * Instances are independent, so tests never share hidden global state.
 */
export function idSequence(prefix: string, options: IdSequenceOptions = {}): IdSequence {
  const start = options.start ?? 1;
  const width = options.width ?? 4;
  assertInteger('sequence start', start, 0, Number.MAX_SAFE_INTEGER - 1);
  assertInteger('sequence width', width, 1, 16);

  let nextValue = start;
  let lastValue = start - 1;

  return {
    prefix,
    width,
    next(): string {
      lastValue = nextValue;
      nextValue += 1;
      return `${prefix}${String(lastValue).padStart(width, '0')}`;
    },
    peek(): string {
      return `${prefix}${String(nextValue).padStart(width, '0')}`;
    },
    current(): number {
      return lastValue;
    },
    reset(): void {
      nextValue = start;
      lastValue = start - 1;
    },
  };
}

/** Emits `count` identifiers from a fresh sequence. */
export function sequenceIds(prefix: string, count: number, options: IdSequenceOptions = {}): string[] {
  assertInteger('sequence count', count, 0, 1_000_000);
  const sequence = idSequence(prefix, options);
  return Array.from({ length: count }, () => sequence.next());
}
