import { MendError } from '@mend/protocol';

/** The evidence-review assistant has no on-chain hub methods at all. */
export const INSPECTOR_ASSISTANT_ALLOWED_HUB_METHODS: readonly string[] = [];

/** Explicitly denied methods, including final acceptance and any money movement. */
export const INSPECTOR_ASSISTANT_FORBIDDEN_METHODS: readonly string[] = [
  'accept_completion',
  'inspect_durability',
  'award',
  'refund',
  'resolve_dispute',
  'record_score',
  'commit_bid',
  'reveal_bid',
  'submit_completion',
  'fund_work_order',
  'ft_transfer',
  'ft_transfer_call',
  'set_role',
  'pause',
];

export function assertInspectorAssistantCannot(method: string): void {
  if (INSPECTOR_ASSISTANT_ALLOWED_HUB_METHODS.includes(method)) return;
  throw new MendError('FORBIDDEN_ROLE', `evidence-review assistant may not call ${method}`, {
    role: 'REVIEWER_AI',
    method,
    allowed: INSPECTOR_ASSISTANT_ALLOWED_HUB_METHODS,
  });
}

/** Final physical acceptance is a human inspector signature, never this agent. */
export function submitFinalAcceptance(): never {
  throw new MendError(
    'FORBIDDEN_ROLE',
    'final completion acceptance belongs to the rostered human inspector; this agent only reports missing items',
  );
}
