import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RealtimeChannelLike, RealtimeClientLike } from './realtime.model';
import { RealtimeSubscription } from './realtime-subscription';
import { REALTIME_POLL_MS } from './realtime-timing';

/** A client whose tables do not exist yet: every channel fails and leaving it rejects. */
function brokenClient() {
  const statuses: ((status: string, error?: Error) => void)[] = [];
  const channel: RealtimeChannelLike = {
    on: () => channel,
    subscribe: (callback) => {
      statuses.push(callback);
      return channel;
    },
  };
  const client: RealtimeClientLike = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(() => Promise.reject(new Error('unsubscribe failed'))),
  };
  return { client, fail: () => statuses.at(-1)?.('CHANNEL_ERROR', new Error('relation "order_events" does not exist')) };
}

describe('RealtimeSubscription without the event tables', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('never throws: retries with growing waits, polls while visible and reports once', async () => {
    const { client, fail } = brokenClient();
    const onRefresh = vi.fn();
    const onError = vi.fn();
    const live = new RealtimeSubscription(client, {
      table: 'order_events', onRefresh, relevant: () => true, visible: () => true, onError,
    });

    fail();
    expect(live.live()).toBe(false);
    // The reconnect leaves the old channel; its rejected promise must be caught.
    await vi.advanceTimersByTimeAsync(2000);
    fail();
    await vi.advanceTimersByTimeAsync(REALTIME_POLL_MS);
    expect(onRefresh).toHaveBeenCalledWith([]);
    expect(vi.mocked(client.channel).mock.calls.length).toBeGreaterThanOrEqual(2);
    // One report per outage, not one per retry.
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);

    live.stop();
    await vi.runAllTimersAsync();
  });
});
