import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import type { LiveUpdates, RealtimeEvent, RealtimeTable } from '@core/realtime/realtime.model';

interface Watcher {
  readonly table: RealtimeTable;
  readonly refresh: (events: readonly RealtimeEvent[]) => unknown;
  readonly relevant: (event: RealtimeEvent) => boolean;
}

/**
 * FakeRealtimeService — RealtimeService for every spec (src/test-providers.ts):
 * no socket; a test delivers a batch with `emit` and sees the screen refresh.
 */
@Injectable()
export class FakeRealtimeService {
  private readonly watchers = new Set<Watcher>();

  public watch(
    table: RealtimeTable,
    refresh: (events: readonly RealtimeEvent[]) => unknown,
    relevant: (event: RealtimeEvent) => boolean = () => true,
  ): LiveUpdates {
    const watcher = { table, refresh, relevant };
    this.watchers.add(watcher);
    inject(DestroyRef).onDestroy(() => this.watchers.delete(watcher));
    const updatedAt = signal<Date | null>(new Date());
    return {
      live: signal(true).asReadonly(),
      updatedAt: updatedAt.asReadonly(),
      refreshAll: async () => {
        await refresh([]);
        updatedAt.set(new Date());
      },
    };
  }

  /** Delivers one batch to the screens listening to `table` (only the events they care about). */
  public async emit(table: RealtimeTable, events: readonly RealtimeEvent[]): Promise<void> {
    for (const watcher of [...this.watchers]) {
      const relevant = events.filter(watcher.relevant);
      if (watcher.table === table && relevant.length) await watcher.refresh(relevant);
    }
  }
}
