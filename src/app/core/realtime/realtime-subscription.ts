import { type Signal, signal } from '@angular/core';
import { HALF } from '@core/config/units';
import type { LiveUpdates, RealtimeChannelLike, RealtimeClientLike, RealtimeEvent } from './realtime.model';
import { Poller, RefreshGate } from './realtime-refresh';
import {
  BACKOFF_FACTOR, FAILED_STATUSES, REALTIME_BATCH_MS, REALTIME_POLL_MS, RECONNECT_BASE_MS, RECONNECT_MAX_MS,
  type RealtimeWatchOptions,
} from './realtime-timing';

let channelCount = 0;

/**
 * RealtimeSubscription — one screen listening to one event table: batches
 * the events, reconnects with growing waits, and polls every 30 s while the
 * channel is down. `refresh` re-reads with normal (RLS) queries. It never throws.
 */
export class RealtimeSubscription implements LiveUpdates {
  private channel: RealtimeChannelLike | null = null;
  private buffer: RealtimeEvent[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private stopped = false;
  private readonly gate = new RefreshGate(() => this.run([]));
  private readonly poller = new Poller(REALTIME_POLL_MS, () => {
    if (this.options.visible()) void this.refreshAll();
  });
  private reported = false;
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

  /** Re-reads everything now (network back, pull to refresh); one read at a time. */
  public refreshAll(): Promise<void> {
    return this.gate.now();
  }

  /**
   * Back to the foreground (Android fires "visibilitychange" and "resume": the
   * second does nothing). A socket that died meanwhile reconnects now.
   */
  public returned(): void {
    if (this.stopped || !this.gate.isNewReturn()) return;
    if (this._live()) void this.refreshAll();
    else this.reconnectNow();
  }

  /** Reconnects at once and refreshes. */
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
    this.poller.stop();
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
      channel.subscribe((status, error) => {
        if (this.channel === channel) this.onStatus(status, error);
      });
    } catch (error) {
      this.onStatus('CHANNEL_ERROR', error);
    }
  }

  private onStatus(status: string, error?: unknown): void {
    if (this.stopped) return;
    if (status === 'SUBSCRIBED') {
      this.attempts = 0;
      this.reported = false;
      this._live.set(true);
      this.poller.stop();
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    } else if (FAILED_STATUSES.has(status)) {
      this.report(error ?? new Error(`realtime ${this.options.table} ${status}`));
      this._live.set(false);
      this.poller.start();
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

  private leave(): void {
    const channel = this.channel;
    this.channel = null;
    if (!channel) return;
    try {
      Promise.resolve(this.client.removeChannel(channel)).catch((error: unknown) => this.report(error));
    } catch (error) {
      this.report(error);
    }
  }

  private report(error: unknown): void {
    if (this.reported) return;
    this.reported = true;
    this.options.onError?.(error);
  }
}
