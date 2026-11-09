import { describe, expect, it } from 'vitest';
import { createRng } from '../src/index.js';

describe('deterministic RNG', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const sequenceA = Array.from({ length: 8 }, () => a.next());
    const sequenceB = Array.from({ length: 8 }, () => b.next());
    expect(sequenceA).toEqual(sequenceB);
    expect(sequenceA.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('produces a different sequence for a different seed', () => {
    const alpha = createRng('alpha');
    const beta = createRng('beta');
    const a = Array.from({ length: 8 }, () => alpha.next());
    const b = Array.from({ length: 8 }, () => beta.next());
    expect(a).not.toEqual(b);
  });

  it('supports bounded integers, picking and deterministic shuffle', () => {
    const rng = createRng('mend');
    for (let index = 0; index < 100; index += 1) {
      const value = rng.int(3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThan(7);
    }
    const items = ['a', 'b', 'c', 'd', 'e'];
    const original = [...items];
    expect(rng.pick(items)).toMatch(/^[a-e]$/);
    const shuffleA = createRng(7).shuffle(items);
    const shuffleB = createRng(7).shuffle(items);
    expect(shuffleA).toEqual(shuffleB);
    expect(shuffleA).not.toBe(items);
    expect(items).toEqual(original);
    expect([...shuffleA].sort()).toEqual([...items].sort());
  });

  it('generates bounded hex strings and rejects invalid input', () => {
    const rng = createRng(1);
    expect(rng.hex(16)).toMatch(/^[0-9a-f]{16}$/);
    expect(rng.hex(0)).toBe('');
    expect(() => rng.hex(-1)).toThrow();
    expect(() => rng.int(5, 5)).toThrow();
    expect(() => rng.pick([])).toThrow();
    expect(() => createRng(1.5)).toThrow();
  });
});
