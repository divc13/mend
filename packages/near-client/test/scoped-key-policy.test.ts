import { describe, expect, it } from 'vitest';
import {
  AGENT_FORBIDDEN_METHODS,
  AGENT_KEY_METHODS,
  NEVER_AGENT_METHODS,
} from '../src/index.js';
// The live scripts are plain .mjs so `node` can run them without a build step.
// @ts-expect-error no TypeScript declarations for the script-side policy mirror
import * as livePolicy from '../../../scripts/live-agents/key-policy.mjs';

const ROLES = ['COORDINATOR_AI', 'CONTRACTOR', 'INSPECTOR'] as const;

describe('live scoped-key policy mirror', () => {
  it('matches the near-client role method lists exactly', () => {
    for (const role of ROLES) {
      expect(livePolicy.AGENT_KEY_METHODS[role]).toEqual(AGENT_KEY_METHODS[role]);
      expect([...livePolicy.AGENT_FORBIDDEN_METHODS[role]].sort()).toEqual(
        [...AGENT_FORBIDDEN_METHODS[role]].sort(),
      );
    }
    expect([...livePolicy.NEVER_AGENT_METHODS].sort()).toEqual([...NEVER_AGENT_METHODS].sort());
  });

  it('never lists a permitted method as forbidden for the same role', () => {
    for (const role of ROLES) {
      const overlap = AGENT_KEY_METHODS[role].filter((method) =>
        livePolicy.AGENT_FORBIDDEN_METHODS[role].includes(method),
      );
      expect(overlap).toEqual([]);
    }
  });

  it('keeps every boundary-proof target forbidden for its role', () => {
    for (const role of ROLES) {
      for (const method of livePolicy.BOUNDARY_TARGETS[role]) {
        expect(livePolicy.AGENT_FORBIDDEN_METHODS[role]).toContain(method);
        expect(livePolicy.AGENT_KEY_METHODS[role]).not.toContain(method);
      }
    }
  });

  it('uses the live testnet hub and a finite allowance', () => {
    expect(livePolicy.HUB_ACCOUNT).toBe('mend-hub.testnet');
    expect(livePolicy.NETWORK).toBe('testnet');
    expect(BigInt(livePolicy.ALLOWANCE_YOCTO)).toBeGreaterThan(0n);
    expect(livePolicy.ALLOWANCE_NEAR).toMatch(/^\d+(\.\d+)?$/);
  });
});
