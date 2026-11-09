/** Small in-process sliding-window limiter. One API process; documented as such. */
export interface LimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

export class SlidingWindowRateLimiter {
  private readonly events = new Map<string, number[]>();

  constructor(private readonly clock: { now(): Date } = { now: () => new Date() }) {}

  consume(key: string, limit: number, windowMs: number): LimitDecision {
    const now = this.clock.now().getTime();
    const cutoff = now - windowMs;
    const recent = (this.events.get(key) ?? []).filter((at) => at > cutoff);
    if (recent.length >= limit) {
      const oldest = recent[0] ?? now;
      const retryAfterMs = Math.max(1000, oldest + windowMs - now);
      this.events.set(key, recent);
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
        remaining: 0,
      };
    }
    recent.push(now);
    this.events.set(key, recent);
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.max(0, limit - recent.length),
    };
  }

  reset(): void {
    this.events.clear();
  }
}
