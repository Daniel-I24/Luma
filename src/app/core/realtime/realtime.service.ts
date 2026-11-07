import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, effect, inject, untracked } from '@angular/core';
import { ErrorLog } from '@core/errors/error-log';
import { AppEvents } from '@core/native/app-events';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { LiveUpdates, RealtimeClientLike, RealtimeEvent, RealtimeTable } from './realtime.model';
import { RealtimeSubscription } from './realtime-subscription';

/**
 * RealtimeService — the only way screens hear about changes made on other
 * phones (docs/realtime.md). Only ids travel (catalog_events, order_events);
 * the screen re-reads what changed with its usual queries, protected by RLS.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly client = inject(SupabaseService).client as unknown as RealtimeClientLike;
  private readonly document = inject(DOCUMENT);
  private readonly connectivity = inject(ConnectivityService);
  private readonly appEvents = inject(AppEvents);
  private readonly log = inject(ErrorLog);

  /**
   * Listens to `table` while the calling screen lives (injection context):
   * `refresh(events)` gets the relevant events of each 500 ms batch, or an
   * empty list when everything should be re-read (back to the foreground,
   * network back, polling while the channel is down, pull to refresh).
   */
  public watch(
    table: RealtimeTable,
    refresh: (events: readonly RealtimeEvent[]) => unknown,
    relevant: (event: RealtimeEvent) => boolean = () => true,
  ): LiveUpdates {
    const visible = (): boolean => this.document.visibilityState === 'visible';
    const subscription = new RealtimeSubscription(this.client, {
      table, onRefresh: refresh, relevant, visible, onError: (error) => this.log.record(error, 'realtime'),
    });
    const onVisibility = (): void => {
      if (visible()) subscription.returned();
    };
    this.document.addEventListener('visibilitychange', onVisibility);

    let wasOnline = untracked(this.connectivity.online);
    const network = effect(() => {
      const online = this.connectivity.online();
      if (online && !wasOnline) subscription.reconnectNow();
      wasOnline = online;
    });
    let resumes = untracked(this.appEvents.resumes);
    const resume = effect(() => {
      const count = this.appEvents.resumes();
      if (count !== resumes) subscription.returned();
      resumes = count;
    });

    inject(DestroyRef).onDestroy(() => {
      subscription.stop();
      network.destroy();
      resume.destroy();
      this.document.removeEventListener('visibilitychange', onVisibility);
    });
    return subscription;
  }
}
