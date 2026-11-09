import { MendError } from '@mend/protocol';

/** The coordinator account may only create draft assets/work orders. */
export const COORDINATOR_ALLOWED_METHODS: readonly string[] = ['create_asset', 'create_work_order'];

/** Every money, award, acceptance, inspection and governance method is denied. */
export const COORDINATOR_FORBIDDEN_METHODS: readonly string[] = [
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
  'dao_authorize',
  'record_score',
  'open_bidding',
  'close_bidding',
  'mint_passport',
];

export function isCoordinatorMethodAllowed(method: string): boolean {
  return COORDINATOR_ALLOWED_METHODS.includes(method);
}

export function assertCoordinatorMethod(method: string): void {
  if (!isCoordinatorMethodAllowed(method)) {
    throw new MendError('FORBIDDEN_ROLE', `coordinator AI may not call ${method}`, {
      role: 'COORDINATOR_AI',
      method,
      allowed: COORDINATOR_ALLOWED_METHODS,
    });
  }
}

export function assertCoordinatorCannot(method: string): void {
  if (isCoordinatorMethodAllowed(method)) {
    throw new Error(`${method} is allowed; use the positive assertion for allowed methods`);
  }
  assertCoordinatorMethod(method);
}
