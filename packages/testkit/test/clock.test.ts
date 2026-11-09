import { describe, expect, it } from 'vitest';
import { FIXTURE_TIMESTAMPS } from '@mend/protocol';
import { advance, fixedClock } from '../src/index.js';

describe('deterministic clock', () => {
  it('starts at the canonical fixture instant by default', () => {
    const clock = fixedClock();
    expect(clock.start).toBe(FIXTURE_TIMESTAMPS.assetCreated);
    expect(clock.now().toISOString()).toBe(FIXTURE_TIMESTAMPS.assetCreated);
    expect(clock.peek()).toBe(FIXTURE_TIMESTAMPS.assetCreated);
  });

  it('advances deterministically and returns new Date instances', () => {
    const clock = fixedClock('2026-11-10T08:00:00.000Z');
    const first = clock.now();
    first.setUTCFullYear(1999);

    expect(clock.now().toISOString()).toBe('2026-11-10T08:00:00.000Z');
    expect(clock.advance(1_000).toISOString()).toBe('2026-11-10T08:00:01.000Z');
    expect(advance(clock, 119_000).toISOString()).toBe('2026-11-10T08:02:00.000Z');
    expect(clock.peek()).toBe('2026-11-10T08:02:00.000Z');
  });

  it('supports explicit jumps without reading the system clock', () => {
    const clock = fixedClock('2026-01-01T00:00:00.000Z');
    clock.set(new Date('2027-06-01T12:30:00.000Z'));
    expect(clock.now().toISOString()).toBe('2027-06-01T12:30:00.000Z');
    expect(clock.start).toBe('2026-01-01T00:00:00.000Z');
  });

  it('keeps independent instances isolated', () => {
    const a = fixedClock('2026-11-10T08:00:00.000Z');
    const b = fixedClock('2026-11-10T08:00:00.000Z');
    a.advance(60_000);
    expect(a.now().toISOString()).toBe('2026-11-10T08:01:00.000Z');
    expect(b.now().toISOString()).toBe('2026-11-10T08:00:00.000Z');
  });

  it('rejects invalid instants and non-integer advances', () => {
    expect(() => fixedClock('not-a-date')).toThrow(/invalid clock instant/);
    const clock = fixedClock();
    expect(() => clock.advance(1.5)).toThrow(/safe integer/);
    expect(() => clock.advance(Number.NaN)).toThrow(/safe integer/);
    expect(() => clock.advance(Number.POSITIVE_INFINITY)).toThrow(/safe integer/);
  });
});
