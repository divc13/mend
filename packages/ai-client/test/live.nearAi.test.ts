import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createNearAiClient } from '../src/nearAiClient.js';

/**
 * Opt-in live smoke test. Skipped by default and when no NEAR_AI_API_KEY is
 * present. It is the only test that may perform network I/O.
 */
const apiKey = process.env.NEAR_AI_API_KEY;

describe.skipIf(!apiKey)('NEAR AI live smoke (opt-in)', () => {
  it(
    'returns strict JSON from the configured model',
    async () => {
      const client = createNearAiClient();
      const record = await client.chatJson({
        system: 'Return strict JSON only.',
        user: 'Return {"ok":true}.',
        schema: z.object({ ok: z.literal(true) }).strict(),
        temperature: 0,
      });
      expect(record.transport).toBe('live');
      expect(record.responseId.length).toBeGreaterThan(0);
      expect(record.requestHash).toMatch(/^[a-f0-9]{64}$/);
      expect(record.responseHash).toMatch(/^[a-f0-9]{64}$/);
    },
    60_000,
  );
});
