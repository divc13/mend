import { describe, expect, it } from 'vitest';
import { idSequence, sequenceIds } from '../src/index.js';

describe('deterministic ids', () => {
  it('emits zero-padded ids from a fresh sequence', () => {
    const sequence = idSequence('CMD-');
    expect(sequence.peek()).toBe('CMD-0001');
    expect(sequence.next()).toBe('CMD-0001');
    expect(sequence.next()).toBe('CMD-0002');
    expect(sequence.peek()).toBe('CMD-0003');
    expect(sequence.current()).toBe(2);
  });

  it('honours start and width and can reset', () => {
    const sequence = idSequence('EV-', { start: 9, width: 2 });
    expect(sequence.next()).toBe('EV-09');
    expect(sequence.next()).toBe('EV-10');
    sequence.reset();
    expect(sequence.current()).toBe(8);
    expect(sequence.next()).toBe('EV-09');
  });

  it('creates independent sequences and ranges', () => {
    const a = idSequence('A-');
    const b = idSequence('B-');
    expect(a.next()).toBe('A-0001');
    expect(b.next()).toBe('B-0001');
    expect(sequenceIds('R-', 3, { start: 1, width: 3 })).toEqual(['R-001', 'R-002', 'R-003']);
    expect(sequenceIds('X-', 0)).toEqual([]);
  });

  it('rejects invalid configuration', () => {
    expect(() => idSequence('X-', { width: 0 })).toThrow();
    expect(() => idSequence('X-', { width: 17 })).toThrow();
    expect(() => idSequence('X-', { start: -1 })).toThrow();
    expect(() => sequenceIds('X-', -1)).toThrow();
    expect(() => sequenceIds('X-', 2.5)).toThrow();
  });
});
