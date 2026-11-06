import { RealtimeClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RealtimeClientLike } from './realtime.model';
import { RealtimeSubscription } from './realtime-subscription';
import { RECONNECT_MAX_MS } from './realtime-timing';

const ABNORMAL = 1006;
const OPEN = 1;
const CLOSED = 3;

/** The network of the test: a socket opens and answers only while it is up. */
class FakeSocket {
  public static online = true;
  public static last: FakeSocket | null = null;
  public readyState = 0;
  public binaryType = 'blob';
  public onopen: (() => void) | null = null;
  public onclose: ((event: { code: number; reason: string; wasClean: boolean }) => void) | null = null;
  public onerror: ((event: unknown) => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;

  constructor(public readonly url: string) {
    FakeSocket.last = this;
    setTimeout(() => {
      if (!FakeSocket.online) return this.drop();
      this.readyState = OPEN;
      this.onopen?.();
    });
  }

  /** Answers every join and heartbeat, echoing the bindings of the join. */
  public send(data: string): void {
    const [joinRef, ref, topic, event, payload] = JSON.parse(data) as [string, string, string, string, Record<string, unknown>];
    const config = (payload['config'] ?? {}) as { postgres_changes?: object[] };
    const postgres = (config.postgres_changes ?? []).map((change, id) => ({ ...change, id }));
    const response = event === 'phx_join' ? { postgres_changes: postgres } : {};
    const reply = [joinRef, ref, topic, 'phx_reply', { status: 'ok', response }];
    setTimeout(() => this.onmessage?.({ data: JSON.stringify(reply) }));
  }

  public close(code = 1000, reason = ''): void {
    this.readyState = CLOSED;
    this.onclose?.({ code, reason, wasClean: true });
  }

  /** The connection is lost: "socket closed: 1006". */
  public drop(): void {
    this.readyState = CLOSED;
    this.onerror?.(new Event('error'));
    this.onclose?.({ code: ABNORMAL, reason: '', wasClean: false });
  }
}

describe('RealtimeSubscription on the real Supabase client, after "socket closed: 1006"', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.online = true;
  });
  afterEach(() => vi.useRealTimers());

  it('reconnects by itself when the network is back, and reports the outage once', async () => {
    const socket = new RealtimeClient('wss://realtime.test/realtime/v1', {
      params: { apikey: 'test' },
      transport: FakeSocket as never,
    });
    const onError = vi.fn();
    const onRefresh = vi.fn();
    const live = new RealtimeSubscription(socket as unknown as RealtimeClientLike, {
      table: 'order_events', onRefresh, relevant: () => true, visible: () => true, onError,
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(live.live()).toBe(true);

    FakeSocket.online = false;
    FakeSocket.last?.drop();
    await vi.advanceTimersByTimeAsync(RECONNECT_MAX_MS * 3);
    expect(live.live()).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledWith([]);

    FakeSocket.online = true;
    await vi.advanceTimersByTimeAsync(RECONNECT_MAX_MS * 2);
    expect(live.live()).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);

    live.stop();
    await socket.disconnect();
  });
});
