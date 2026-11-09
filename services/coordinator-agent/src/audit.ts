import { makeEvent } from '@mend/protocol';
import type { MendEvent } from '@mend/protocol';

/** Append-only in-memory audit log for one coordinator process. */
export class CoordinatorAuditLog {
  private readonly events: MendEvent[] = [];

  append(event: MendEvent): void {
    this.events.push(event);
  }

  record(name: Parameters<typeof makeEvent>[0], data: Record<string, unknown>, meta: Parameters<typeof makeEvent>[2]): void {
    this.append(makeEvent(name, data, meta));
  }

  all(): readonly MendEvent[] {
    return [...this.events];
  }

  find(name: string): MendEvent[] {
    return this.events.filter((event) => event.name === name);
  }
}
