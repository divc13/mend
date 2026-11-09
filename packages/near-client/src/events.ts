import { EVENT_NAMES } from '@mend/protocol';
import type { EventName } from '@mend/protocol';

const EVENT_PREFIX = 'EVENT_JSON:';
const MEND_STANDARD = 'mend';
const MEND_VERSION = '1.0.0';

export interface ParsedMendEvent {
  name: EventName;
  workOrderId?: string;
  assetId?: string;
  actor?: string;
  data: Record<string, unknown>;
  raw: string;
}

export interface ParsedEventResult {
  events: ParsedMendEvent[];
  ignored: Array<{ raw: string; reason: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Parses `EVENT_JSON:` logs emitted by the MEND hub. Unknown standards,
 * versions and event names are ignored and reported; they are never coerced
 * into a trusted event.
 */
export function parseMendEvents(logs: readonly string[]): ParsedEventResult {
  const events: ParsedMendEvent[] = [];
  const ignored: Array<{ raw: string; reason: string }> = [];

  for (const raw of logs) {
    if (typeof raw !== 'string' || !raw.startsWith(EVENT_PREFIX)) continue;
    let payload: unknown;
    try {
      payload = JSON.parse(raw.slice(EVENT_PREFIX.length));
    } catch {
      ignored.push({ raw, reason: 'invalid-json' });
      continue;
    }
    if (!isRecord(payload)) {
      ignored.push({ raw, reason: 'not-an-object' });
      continue;
    }
    if (payload.standard !== MEND_STANDARD || payload.version !== MEND_VERSION) {
      ignored.push({ raw, reason: 'wrong-standard-or-version' });
      continue;
    }
    const name = payload.event;
    if (typeof name !== 'string' || !(EVENT_NAMES as readonly string[]).includes(name)) {
      ignored.push({ raw, reason: 'unknown-event-name' });
      continue;
    }
    const data = isRecord(payload.data) ? payload.data : {};
    const event: ParsedMendEvent = { name: name as EventName, data, raw };
    if (typeof payload.work_order_id === 'string') event.workOrderId = payload.work_order_id;
    else if (typeof data.work_order_id === 'string') event.workOrderId = data.work_order_id;
    if (typeof payload.asset_id === 'string') event.assetId = payload.asset_id;
    else if (typeof data.asset_id === 'string') event.assetId = data.asset_id;
    if (typeof payload.actor === 'string') event.actor = payload.actor;
    else if (typeof data.actor === 'string') event.actor = data.actor;
    events.push(event);
  }

  return { events, ignored };
}

export function encodeMendEvent(event: EventName, data: Record<string, unknown>): string {
  return `${EVENT_PREFIX}${JSON.stringify({ standard: MEND_STANDARD, version: MEND_VERSION, event, data })}`;
}
