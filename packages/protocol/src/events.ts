export const EVENT_NAMES = [
  'work_order_created',
  'policy_approved',
  'work_order_funded',
  'funding_failed',
  'bidding_opened',
  'bidding_closed',
  'bid_committed',
  'bid_revealed',
  'score_recorded',
  'work_order_awarded',
  'work_started',
  'completion_submitted',
  'completion_accepted',
  'payment_released',
  'durability_inspection_recorded',
  'durability_passed',
  'warranty_reopened',
  'dispute_opened',
  'dispute_resolved',
  'work_order_refunded',
  'work_order_cancelled',
  'contract_paused',
  'contract_unpaused',
  'passport_minted',
  'passport_transfer_rejected',
  'relayer_rejected',
  'prompt_injection_blocked',
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

export interface MendEvent<T extends Record<string, unknown> = Record<string, unknown>> {
  name: EventName;
  workOrderId?: string;
  assetId?: string;
  actor?: string;
  timestamp: string;
  data: T;
}

export function makeEvent<T extends Record<string, unknown>>(
  name: EventName,
  data: T,
  meta: { workOrderId?: string; assetId?: string; actor?: string; timestamp?: string } = {},
): MendEvent<T> {
  return {
    name,
    ...(meta.workOrderId ? { workOrderId: meta.workOrderId } : {}),
    ...(meta.assetId ? { assetId: meta.assetId } : {}),
    ...(meta.actor ? { actor: meta.actor } : {}),
    timestamp: meta.timestamp ?? new Date().toISOString(),
    data,
  };
}
