import type { AppDeps } from '../context.js';

/**
 * Append-only audit helper. Audit rows never store precise locations, private
 * media keys, signed URLs or secrets.
 */
export async function auditEvent(
  deps: AppDeps,
  name: string,
  actor: string,
  meta: { workOrderId?: string; assetId?: string },
  data: Record<string, unknown>,
): Promise<void> {
  await deps.repo.appendAudit({
    id: `A-${String(await deps.repo.nextSequence('audit')).padStart(5, '0')}`,
    name,
    actor,
    at: deps.clock.now().toISOString(),
    ...meta,
    data,
  });
}
