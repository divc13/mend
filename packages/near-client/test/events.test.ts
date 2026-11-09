import { describe, expect, it } from 'vitest';
import { encodeMendEvent, parseMendEvents } from '../src/index.js';

describe('MEND event parsing', () => {
  it('parses standard MEND events', () => {
    const log = encodeMendEvent('bid_committed', {
      work_order_id: 'WO-BENCH-001-0001',
      bid_id: 'BID-A-BENCH-001',
      commitment_hash: 'a'.repeat(64),
    });
    const parsed = parseMendEvents([log]);
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0]?.name).toBe('bid_committed');
    expect(parsed.events[0]?.workOrderId).toBe('WO-BENCH-001-0001');
  });

  it('ignores non-MEND, malformed and unknown events', () => {
    const parsed = parseMendEvents([
      'random log',
      'EVENT_JSON:{bad json',
      'EVENT_JSON:{"standard":"nep141","version":"1.0.0","event":"ft_transfer","data":{}}',
      'EVENT_JSON:{"standard":"mend","version":"1.0.0","event":"not_real","data":{}}',
    ]);
    expect(parsed.events).toHaveLength(0);
    expect(parsed.ignored).toHaveLength(3);
  });

  it('does not coerce a non-object data field', () => {
    const parsed = parseMendEvents([
      'EVENT_JSON:{"standard":"mend","version":"1.0.0","event":"work_order_created","data":"oops"}',
    ]);
    expect(parsed.events[0]?.data).toEqual({});
  });
});
