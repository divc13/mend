import { MendError } from '@mend/protocol';

/**
 * A contractor agent may bid and submit completion, never inspect or move money.
 * This list mirrors the live function-call key exactly; `start_work` is not in
 * the scoped key, so the agent must not claim it can start work.
 */
export const CONTRACTOR_ALLOWED_METHODS: readonly string[] = [
  'commit_bid',
  'reveal_bid',
  'submit_completion',
];

export const CONTRACTOR_FORBIDDEN_METHODS: readonly string[] = [
  'start_work',
  'award',
  'accept_completion',
  'inspect_durability',
  'refund',
  'resolve_dispute',
  'open_dispute',
  'cancel_work_order',
  'fund_work_order',
  'ft_transfer',
  'ft_transfer_call',
  'set_role',
  'pause',
  'unpause',
  'record_score',
  'open_bidding',
  'close_bidding',
];

export function assertContractorMethod(method: string): void {
  if (!CONTRACTOR_ALLOWED_METHODS.includes(method)) {
    throw new MendError('FORBIDDEN_ROLE', `contractor agent may not call ${method}`, {
      role: 'CONTRACTOR',
      method,
      allowed: CONTRACTOR_ALLOWED_METHODS,
    });
  }
}
