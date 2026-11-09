import type { WorkOrderState } from './types';

export const STATE_COPY: Record<WorkOrderState, { meaning: string; next: string }> = {
  DRAFT: {
    meaning: 'A steward has proposed a scope and maximum budget, but the DAO has not authorized the envelope or roster.',
    next: 'DAO authorization attaches the approved policy, budget, contractor roster and inspector roster.',
  },
  POLICY_APPROVED: {
    meaning: 'The DAO envelope, roster and scoring policy are approved. The work order is waiting for sponsor funding.',
    next: 'The sponsor funds the exact remaining budget in the correct token.',
  },
  FUNDED: {
    meaning: 'The full budget is held in escrow. No contractor has been chosen and bidding has not opened.',
    next: 'The steward opens sealed bidding.',
  },
  BIDDING_OPEN: {
    meaning: 'Rostered contractors can submit sealed commitments. Competing prices, durations and warranties are not public.',
    next: 'After the commit deadline, contractors reveal; after the reveal deadline, bidding closes.',
  },
  BIDDING_REVEAL: {
    meaning: 'Reveals are checked against commitments, eligibility and deadlines. No new sealed bid can win.',
    next: 'A hash-pinned deterministic WASM policy scores every eligible revealed bid.',
  },
  SCORED: {
    meaning: 'The deterministic ranking is recorded with policy, WASM, input and output hashes. No LLM chose the winner.',
    next: 'The steward confirms the rank-1 eligible bid. The unallocated budget returns to the sponsor.',
  },
  AWARDED: {
    meaning: 'A single eligible bid is locked and the contractor is named. The award remains in escrow.',
    next: 'The awarded contractor starts work and later submits redacted completion evidence.',
  },
  IN_PROGRESS: {
    meaning: 'The awarded contractor is working. No completion payment can be released in this state.',
    next: 'The contractor submits the required redacted evidence checklist.',
  },
  COMPLETION_SUBMITTED: {
    meaning: 'Completion evidence is submitted and awaiting independent human review. Payment is still held.',
    next: 'A rostered inspector — never the contractor — accepts or rejects completion.',
  },
  COMPLETION_ACCEPTED: {
    meaning: 'A human inspector accepted completion. Exactly 90% is paid and 10% remains as the durability holdback.',
    next: 'The predetermined durability inspection decides whether the holdback releases or the warranty reopens.',
  },
  DURABILITY_PENDING: {
    meaning: 'The durability window is open. The 10% holdback is held and the inspection timestamp is fixed.',
    next: 'An independent durability decision releases the holdback or reopens the same work order.',
  },
  CLOSED: {
    meaning: 'The durability inspection passed, the holdback released once and the work order is financially immutable.',
    next: 'No further payment is possible. The history remains in the asset passport.',
  },
  WARRANTY_REOPENED: {
    meaning:
      'A durability inspection failed. The same work order reopened with no new escrow, no new bounty and the failure preserved.',
    next: 'Remediation evidence must be accepted, then a later durability inspection must pass before the holdback releases.',
  },
  DISPUTED: {
    meaning: 'A named human opened a dispute. Relevant funds are frozen and AI has no authority to resolve it.',
    next: 'An explicit human/DAO resolution selects an allowed state; payouts stay frozen until then.',
  },
  CANCELLED: {
    meaning: 'A pre-award work order was cancelled by a steward. Remaining escrow is still held.',
    next: 'A refund returns the remaining escrow to the sponsor exactly once.',
  },
  REFUNDED: {
    meaning: 'Remaining escrow has been returned to the sponsor. The work order is terminal and cannot be paid again.',
    next: 'No further financial action. The asset history records the cancellation and refund.',
  },
  FUNDING_FAILED: {
    meaning: 'Funding did not complete. No work may start and no contractor can be awarded.',
    next: 'The remaining escrow can be refunded; the work order is terminal for repair purposes.',
  },
  PAUSED: {
    meaning: 'The hub or a human kill switch paused state-changing actions. Views remain available.',
    next: 'An authorized owner/DAO unpause returns the work order to exactly the previous state.',
  },
};
