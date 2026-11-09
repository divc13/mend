import type { Repository } from '@mend/db';
import { systemClock, type Clock } from './chain.js';

export interface KillSwitchStatus {
  enabled: boolean;
  reason: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export const KILL_SWITCH_SCOPE = 'all mutating /v1 routes; reads remain available';

/**
 * Human kill switch. The in-process value is the source of truth for request
 * gating; every transition is also appended to the audit log so a restarted
 * process restores the last human decision instead of silently resuming writes.
 */
export class KillSwitchService {
  private state: KillSwitchStatus = {
    enabled: false,
    reason: 'Kill switch is not engaged',
    updatedAt: null,
    updatedBy: null,
  };

  constructor(private readonly clock: Clock = systemClock) {}

  get status(): KillSwitchStatus {
    return { ...this.state };
  }

  get enabled(): boolean {
    return this.state.enabled;
  }

  set(enabled: boolean, reason: string, actor: string): KillSwitchStatus {
    this.state = {
      enabled,
      reason,
      updatedAt: this.clock.now().toISOString(),
      updatedBy: actor,
    };
    return this.status;
  }

  restore(status: KillSwitchStatus): void {
    this.state = { ...status };
  }
}

function auditOrder(a: { at: string; id: string }, b: { at: string; id: string }): number {
  const byTime = Date.parse(a.at) - Date.parse(b.at);
  if (byTime !== 0 && Number.isFinite(byTime)) return byTime;
  return a.id.localeCompare(b.id, undefined, { numeric: true });
}

/** Rehydrates the switch from append-only kill-switch audit events. */
export async function restoreKillSwitch(repo: Repository, clock: Clock = systemClock): Promise<KillSwitchService> {
  const service = new KillSwitchService(clock);
  const [enabledEvents, disabledEvents] = await Promise.all([
    repo.listAudit({ name: 'kill_switch_enabled' }),
    repo.listAudit({ name: 'kill_switch_disabled' }),
  ]);
  const latest = [...enabledEvents, ...disabledEvents].sort(auditOrder).at(-1);
  if (!latest) return service;
  const enabled = latest.name === 'kill_switch_enabled';
  service.restore({
    enabled,
    reason: typeof latest.data.reason === 'string' ? latest.data.reason : (enabled ? 'Kill switch engaged' : 'Kill switch released'),
    updatedAt: latest.at,
    updatedBy: latest.actor,
  });
  return service;
}
