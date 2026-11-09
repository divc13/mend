import { describe, expect, it } from 'vitest';
import {
  DISPUTABLE_STATES,
  WORK_ORDER_STATES,
  canTransition,
  isDisputable,
  isTerminal,
  nextStates,
  type WorkOrderState,
} from '../src/state-machine.js';

const HAPPY_PATH: WorkOrderState[] = [
  'DRAFT',
  'POLICY_APPROVED',
  'FUNDED',
  'BIDDING_OPEN',
  'BIDDING_REVEAL',
  'SCORED',
  'AWARDED',
  'IN_PROGRESS',
  'COMPLETION_SUBMITTED',
  'COMPLETION_ACCEPTED',
  'DURABILITY_PENDING',
  'CLOSED',
];

describe('work-order state machine', () => {
  it('accepts the canonical successful lifecycle', () => {
    for (let i = 0; i < HAPPY_PATH.length - 1; i += 1) {
      const from = HAPPY_PATH[i]!;
      const to = HAPPY_PATH[i + 1]!;
      expect(canTransition(from, to), `${from} -> ${to}`).toEqual({ ok: true });
    }
  });

  it('accepts a warranty reopening loop without new states', () => {
    const loop: WorkOrderState[] = [
      'DURABILITY_PENDING',
      'WARRANTY_REOPENED',
      'IN_PROGRESS',
      'COMPLETION_SUBMITTED',
      'COMPLETION_ACCEPTED',
      'DURABILITY_PENDING',
      'CLOSED',
    ];
    for (let i = 0; i < loop.length - 1; i += 1) {
      expect(canTransition(loop[i]!, loop[i + 1]!)).toEqual({ ok: true });
    }
  });

  it('rejects invalid jumps, no-ops and transitions out of terminal states', () => {
    expect(canTransition('DRAFT', 'AWARDED').ok).toBe(false);
    expect(canTransition('DRAFT', 'DRAFT').ok).toBe(false);
    expect(canTransition('CLOSED', 'IN_PROGRESS').ok).toBe(false);
    expect(canTransition('CANCELLED', 'AWARDED').ok).toBe(false);
    expect(canTransition('BIDDING_OPEN', 'AWARDED').ok).toBe(false);
  });

  it('requires pause context and restores only the previous state', () => {
    expect(canTransition('IN_PROGRESS', 'PAUSED')).toEqual({ ok: true });
    expect(canTransition('PAUSED', 'IN_PROGRESS').ok).toBe(false);
    expect(canTransition('PAUSED', 'IN_PROGRESS', { pausedFrom: 'IN_PROGRESS' })).toEqual({ ok: true });
    expect(canTransition('PAUSED', 'AWARDED', { pausedFrom: 'IN_PROGRESS' }).ok).toBe(false);
  });

  it('blocks dispute opening outside disputable states', () => {
    for (const state of WORK_ORDER_STATES) {
      const check = canTransition(state, 'DISPUTED');
      if ((DISPUTABLE_STATES as readonly string[]).includes(state)) {
        expect(check, state).toEqual({ ok: true });
        expect(isDisputable(state), state).toBe(true);
      } else {
        expect(check.ok, state).toBe(false);
      }
    }
  });

  it('requires explicit human resolution to leave DISPUTED', () => {
    expect(canTransition('DISPUTED', 'IN_PROGRESS').ok).toBe(false);
    expect(canTransition('DISPUTED', 'IN_PROGRESS', { humanResolution: true })).toEqual({ ok: true });
    expect(canTransition('DISPUTED', 'DRAFT', { humanResolution: true }).ok).toBe(false);
  });

  it('marks terminal states and exposes next states for UI', () => {
    expect(isTerminal('CLOSED')).toBe(true);
    expect(isTerminal('REFUNDED')).toBe(true);
    expect(isTerminal('IN_PROGRESS')).toBe(false);
    expect(nextStates('DURABILITY_PENDING')).toContain('WARRANTY_REOPENED');
  });
});
