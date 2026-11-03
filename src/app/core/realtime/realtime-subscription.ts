import { type Signal, signal } from '@angular/core';
import { HALF, MS_PER_SECOND } from '@core/config/units';
import type { LiveUpdates, RealtimeChannelLike, RealtimeClientLike, RealtimeEvent, RealtimeTable } from './realtime.model';

/** What one screen listens to and how it refreshes. */
export interface RealtimeWatchOptions {
  readonly table: RealtimeTable;
  readonly onRefresh: (events: readonly RealtimeEvent[]) => unknown;
  readonly relevant: (event: RealtimeEvent) => boolean;
  readonly visible: () => boolean;
}

/** Events within this window are refreshed once. */
export const REALTIME_BATCH_MS = 500;
/** Fallback polling while the channel is down (and only with the screen visible). */
export const REALTIME_POLL_MS = 30_000;
const RECONNECT_BASE_MS = MS_PER_SECOND;
const RECONNECT_MAX_MS = 30_000;
/** Each failed try doubles the wait. */
const BACKOFF_FACTOR = 2;
const FAILED = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);

let channelCount = 0;

/**
 * RealtimeSubscription — one screen listening to one event table: batches
 * the events, reconnects with growing waits, and polls every 30 s while the
 * channel is down. `refresh` re-reads the screen with normal (RLS) queries.
 */
export class RealtimeSubscription implements LiveUpdates {
  private channel: RealtimeChannelLike | null = null;
  private buffer: RealtimeEvent[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private attempts = 0;
  private stopped = false;
  private readonly _live = signal(false);
  private readonly _updatedAt = signal<Date | null>(new Date());
  public readonly live: Signal<boolean> = this._live.asReadonly();
  public readonly updatedAt: Signal<Date | null> = this._updatedAt.asReadonly();

  constructor(
    private readonly client: RealtimeClientLike,
    private readonly options: RealtimeWatchOptions,
  ) {
    this.connect();
  }

  /** Re-reads everything now (foreground, network back, pull to refresh). */
  public async refreshAll(): Promise<void> {
    await this.run([]);
  }

  /** The network came back: reconnect at once and refresh. */
  public reconnectNow(): void {
    if (this.stopped) return;
    this.attempts = 0;
    this.connect();
    void this.refreshAll();
  }

  /** Leaves the channel and stops every timer (the screen was left). */
  public stop(): void {
    this.stopped = true;
    for (const timer of [this.batchTimer, this.reconnectTimer]) if (timer) clearTimeout(timer);
    this.stopPolling();
    this.leave();
  }

  private connect(): void {
    this.leave();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const filter = { event: 'INSERT', schema: 'public', table: this.options.table } as const;
    try {
      const channel = this.client
        .channel(`luma-${this.options.table}-${++channelCount}`)
        .on('postgres_changes', filter, (payload) => this.receive(payload.new));
      this.channel = channel;
      // A channel that was left (reconnect, screen left) says CLOSED: not news.
      channel.subscribe((status) => {
        if (this.channel === channel) this.onStatus(status);
      });
    } catch {
      // Realtime unavailable: the same as a failed channel (polling, retry).
      this.onStatus('CHANNEL_ERROR');
    }
  }

  private onStatus(status: string): void {
    if (this.stopped) return;
    if (status === 'SUBSCRIBED') {
      this.attempts = 0;
      this._live.set(true);
      this.stopPolling();
    } else if (FAILED.has(status)) {
      this._live.set(false);
      this.startPolling();
      this.scheduleReconnect();
    }
  }

  private receive(event: RealtimeEvent): void {
    if (this.stopped || !this.options.relevant(event)) return;
    this.buffer.push(event);
    this.batchTimer ??= setTimeout(() => {
      this.batchTimer = null;
      const batch = this.buffer;
      this.buffer = [];
      void this.run(batch);
    }, REALTIME_BATCH_MS);
  }

  private async run(events: readonly RealtimeEvent[]): Promise<void> {
    try {
      await this.options.onRefresh(events);
      this._updatedAt.set(new Date());
    } catch {
      // The screen keeps what it shows; the next event or poll tries again.
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const wait = Math.min(RECONNECT_BASE_MS * BACKOFF_FACTOR ** this.attempts++, RECONNECT_MAX_MS);
    this.reconnectTimer = setTimeout(() => this.connect(), wait + Math.random() * wait * HALF);
  }

  private startPolling(): void {
    this.pollTimer ??= setInterval(() => {
      if (this.options.visible()) void this.refreshAll();
    }, REALTIME_POLL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private leave(): void {
    const channel = this.channel;
    this.channel = null;
    if (channel) this.client.removeChannel(channel);
  }
}
