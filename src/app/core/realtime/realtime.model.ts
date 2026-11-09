import type { Signal } from '@angular/core';

/** The event tables of the supabase_realtime publication (ids and a time, never rows). */
export type RealtimeTable = 'catalog_events' | 'order_events';

/** One event: what changed, by id. An empty batch means "refresh everything". */
export interface RealtimeEvent {
  readonly kind?: string;
  readonly business_id?: string | null;
  readonly order_id?: string | null;
  readonly user_id?: string | null;
}

/** The part of a Supabase Realtime channel this code uses. */
export interface RealtimeChannelLike {
  on(type: 'postgres_changes', filter: { event: 'INSERT'; schema: 'public'; table: string },
    callback: (payload: { new: RealtimeEvent }) => void): RealtimeChannelLike;
  subscribe(callback: (status: string, error?: Error) => void): RealtimeChannelLike;
}

/** The part of the Supabase client this code uses. */
export interface RealtimeClientLike {
  channel(name: string): RealtimeChannelLike;
  removeChannel(channel: RealtimeChannelLike): unknown;
}

/** What a screen gets from RealtimeService.watch. */
export interface LiveUpdates {
  /** True while the channel is connected (false: polling every 30 s). */
  readonly live: Signal<boolean>;
  /** When the screen's data was last refreshed. */
  readonly updatedAt: Signal<Date | null>;
  /** True during a read the user asked for. */
  readonly refreshing: Signal<boolean>;
  /** Re-reads everything now (pull to refresh, the reload button). */
  refreshAll(): Promise<void>;
}
