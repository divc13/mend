import { FIXTURE_TIMESTAMPS } from '@mend/protocol';

function toDate(instant: string | Date): Date {
  const date = instant instanceof Date ? new Date(instant.getTime()) : new Date(instant);
  if (Number.isNaN(date.getTime())) throw new Error(`invalid clock instant: ${String(instant)}`);
  return date;
}

export interface TestClock {
  readonly kind: 'fixed';
  /** The instant this clock was created at. */
  readonly start: string;
  now(): Date;
  /** Advances by a signed integer number of milliseconds and returns the new time. */
  advance(ms: number): Date;
  /** Jumps to an explicit instant. */
  set(instant: string | Date): Date;
  /** Current time as an ISO string. */
  peek(): string;
}

/**
 * A deterministic, mutable clock. `now()` always returns a fresh Date so a
 * caller cannot mutate the clock's internal time by accident.
 */
export function fixedClock(start: string | Date = FIXTURE_TIMESTAMPS.assetCreated): TestClock {
  const initial = toDate(start).getTime();
  let current = initial;

  return {
    kind: 'fixed',
    start: new Date(initial).toISOString(),
    now: () => new Date(current),
    advance(ms: number): Date {
      if (!Number.isSafeInteger(ms)) {
        throw new Error(`clock advance must be a safe integer number of milliseconds: ${String(ms)}`);
      }
      current += ms;
      return new Date(current);
    },
    set(instant: string | Date): Date {
      current = toDate(instant).getTime();
      return new Date(current);
    },
    peek: () => new Date(current).toISOString(),
  };
}

export function advance(clock: TestClock, ms: number): Date {
  return clock.advance(ms);
}
