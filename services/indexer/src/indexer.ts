import type { Repository } from '@mend/db';
import { MendError } from '@mend/protocol';
import { applyEvent, publicStateHash } from './read-model.js';
import type { HubEventSource, IndexedHubEvent } from './events.js';

export interface SyncResult {
  source: string;
  processed: number;
  skipped: number;
  cursor: string | null;
  publicStateHash: string;
}

export interface RebuildResult extends SyncResult {
  rebuilt: true;
  previousCursorCleared: true;
}

/**
 * Event-consuming read-model indexer. Every event is applied inside a
 * transaction that also inserts its idempotency key. A crash rolls back both, so
 * replay is safe. Rebuild deletes the public read model (never audit events)
 * and replays the source from the beginning.
 */
export class HubIndexer {
  constructor(
    private readonly repo: Repository,
    private readonly source: HubEventSource,
    private readonly options: { batchSize?: number } = {},
  ) {}

  get sourceInfo(): { name: string; available: boolean; reason?: string } {
    return {
      name: this.source.name,
      available: this.source.available,
      ...(this.source.unavailableReason ? { reason: this.source.unavailableReason } : {}),
    };
  }

  async sync(): Promise<SyncResult> {
    if (!this.source.available) {
      throw new MendError('UPSTREAM_UNAVAILABLE', this.source.unavailableReason ?? 'Event source unavailable', {
        source: this.source.name,
      });
    }
    let cursor = await this.repo.getIndexerCursor(this.source.name);
    let processed = 0;
    let skipped = 0;

    for (;;) {
      const batch = await this.source.fetch(cursor);
      if (batch.events.length === 0) {
        if (batch.nextCursor && batch.nextCursor !== cursor) {
          cursor = batch.nextCursor;
          await this.repo.setIndexerCursor(this.source.name, cursor);
        }
        break;
      }
      for (const event of batch.events) {
        const applied = await this.repo.transaction(async (tx) => {
          const fresh = await tx.markEventProcessed(event.key, this.source.name);
          if (!fresh) return false;
          await applyEvent(tx, event);
          return true;
        });
        if (applied) processed += 1;
        else skipped += 1;
      }
      cursor = batch.nextCursor;
      if (cursor) await this.repo.setIndexerCursor(this.source.name, cursor);
      if (!batch.hasMore) break;
    }

    return {
      source: this.source.name,
      processed,
      skipped,
      cursor,
      publicStateHash: await publicStateHash(this.repo),
    };
  }

  async rebuild(): Promise<RebuildResult> {
    await this.repo.resetIndexerState(this.source.name);
    await this.repo.clearReadModel();
    const result = await this.sync();
    return { ...result, rebuilt: true, previousCursorCleared: true };
  }

  /** Test/integration helper: process a fixed array of events idempotently. */
  async consume(events: readonly IndexedHubEvent[]): Promise<{ processed: number; skipped: number }> {
    let processed = 0;
    let skipped = 0;
    for (const event of events) {
      const applied = await this.repo.transaction(async (tx) => {
        const fresh = await tx.markEventProcessed(event.key, this.source.name);
        if (!fresh) return false;
        await applyEvent(tx, event);
        return true;
      });
      if (applied) processed += 1;
      else skipped += 1;
    }
    return { processed, skipped };
  }
}
