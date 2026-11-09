export const WORK_ORDER_STATES = [
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
  'WARRANTY_REOPENED',
  'DISPUTED',
  'CANCELLED',
  'REFUNDED',
  'FUNDING_FAILED',
  'PAUSED',
] as const;

export type WorkOrderState = (typeof WORK_ORDER_STATES)[number];

export const TERMINAL_STATES: readonly WorkOrderState[] = ['CLOSED', 'REFUNDED', 'FUNDING_FAILED'];

export const PRE_AWARD_STATES: readonly WorkOrderState[] = [
  'DRAFT',
  'POLICY_APPROVED',
  'FUNDED',
  'BIDDING_OPEN',
  'BIDDING_REVEAL',
  'SCORED',
];

/** States in which a dispute may be opened. */
export const DISPUTABLE_STATES: readonly WorkOrderState[] = [
  'AWARDED',
  'IN_PROGRESS',
  'COMPLETION_SUBMITTED',
  'COMPLETION_ACCEPTED',
  'DURABILITY_PENDING',
  'WARRANTY_REOPENED',
];

/** States a dispute may resolve back into. Requires an explicit human/DAO resolution. */
export const DISPUTE_RESOLUTION_TARGETS: readonly WorkOrderState[] = [
  'AWARDED',
  'IN_PROGRESS',
  'COMPLETION_SUBMITTED',
  'COMPLETION_ACCEPTED',
  'DURABILITY_PENDING',
  'WARRANTY_REOPENED',
  'CLOSED',
  'REFUNDED',
];

export const TRANSITIONS: Readonly<Record<WorkOrderState, readonly WorkOrderState[]>> = {
  DRAFT: ['POLICY_APPROVED', 'CANCELLED', 'PAUSED'],
  POLICY_APPROVED: ['FUNDED', 'FUNDING_FAILED', 'CANCELLED', 'PAUSED'],
  FUNDED: ['BIDDING_OPEN', 'CANCELLED', 'REFUNDED', 'PAUSED'],
  BIDDING_OPEN: ['BIDDING_REVEAL', 'CANCELLED', 'PAUSED'],
  BIDDING_REVEAL: ['SCORED', 'CANCELLED', 'PAUSED'],
  SCORED: ['AWARDED', 'CANCELLED', 'REFUNDED', 'PAUSED'],
  AWARDED: ['IN_PROGRESS', 'DISPUTED', 'PAUSED'],
  IN_PROGRESS: ['COMPLETION_SUBMITTED', 'DISPUTED', 'PAUSED'],
  COMPLETION_SUBMITTED: ['COMPLETION_ACCEPTED', 'DISPUTED', 'PAUSED'],
  COMPLETION_ACCEPTED: ['DURABILITY_PENDING', 'DISPUTED', 'PAUSED'],
  DURABILITY_PENDING: ['CLOSED', 'WARRANTY_REOPENED', 'DISPUTED', 'PAUSED'],
  WARRANTY_REOPENED: ['IN_PROGRESS', 'DISPUTED', 'PAUSED'],
  DISPUTED: [],
  CANCELLED: ['REFUNDED'],
  REFUNDED: [],
  FUNDING_FAILED: ['REFUNDED'],
  CLOSED: [],
  PAUSED: [],
};

export interface TransitionContext {
  /** State the contract was in before it was paused. Required to resume. */
  pausedFrom?: WorkOrderState;
  /** Must be true for DISPUTED -> resolution targets; forces an explicit human/DAO resolution. */
  humanResolution?: boolean;
}

export interface TransitionCheck {
  ok: boolean;
  reason?: string;
}

export function canTransition(
  from: WorkOrderState,
  to: WorkOrderState,
  ctx: TransitionContext = {},
): TransitionCheck {
  if (from === to) return { ok: false, reason: 'state did not change' };

  if (from === 'PAUSED') {
    if (!ctx.pausedFrom) return { ok: false, reason: 'pausedFrom is required to unpause' };
    if (ctx.pausedFrom === 'PAUSED') return { ok: false, reason: 'invalid pausedFrom' };
    if (ctx.pausedFrom === to) return { ok: true };
    return { ok: false, reason: `unpause must return to previous state ${ctx.pausedFrom}` };
  }

  if (from === 'DISPUTED') {
    if (!ctx.humanResolution) {
      return { ok: false, reason: 'dispute resolution requires explicit human/DAO resolution' };
    }
    if ((DISPUTE_RESOLUTION_TARGETS as readonly string[]).includes(to)) return { ok: true };
    return { ok: false, reason: `cannot resolve dispute into ${to}` };
  }

  const allowed = TRANSITIONS[from];
  return (allowed as readonly string[]).includes(to)
    ? { ok: true }
    : { ok: false, reason: `invalid transition ${from} -> ${to}` };
}

export function nextStates(from: WorkOrderState): readonly WorkOrderState[] {
  return TRANSITIONS[from];
}

export function isTerminal(state: WorkOrderState): boolean {
  return (TERMINAL_STATES as readonly string[]).includes(state);
}

export function isDisputable(state: WorkOrderState): boolean {
  return (DISPUTABLE_STATES as readonly string[]).includes(state);
}
