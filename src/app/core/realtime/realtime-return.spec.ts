import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RealtimeChannelLike, RealtimeClientLike } from './realtime.model';
import { RealtimeSubscription } from './realtime-subscription';
import { RECONNECT_BASE_MS, RETURN_GAP_MS } from './realtime-timing';

/** A client that counts the channels joined and left. */
function client() {
  const statuses: ((status: string, error?: Error) => void)[] = [];
  const channel: RealtimeChannelLike = {
    on: () => channel,
    subscribe: (callback) => {
      statuses.push(callback);
      return channel;
    },
  };
  const fake: RealtimeClientLike = { channel: vi.fn(() => channel), removeChannel: vi.fn(() => Promise.resolve('ok')) };
  return { fake, status: (value: string) => statuses.at(-1)?.(value) };
}

describe('RealtimeSubscription: coming back to the app', () => {
  let onRefresh: Mock<() => Promise<void>>;
  const open = (fake: RealtimeClientLike) =>
    new RealtimeSubscription(fake, { table: 'catalog_events', onRefresh, relevant: () => true, visible: () => true });

  beforeEach(() => {
    vi.useFakeTimers();
    onRefresh = vi.fn<() => Promise<void>>(() => Promise.resolve());
  });
  afterEach(() => vi.useRealTimers());

  it('"visibilitychange" and "resume" of one return read the screen once', async () => {
    const { fake, status } = client();
    const live = open(fake);
    status('SUBSCRIBED');
    live.returned();
    await vi.advanceTimersByTimeAsync(0);
    live.returned();
    await vi.advanceTimersByTimeAsync(0);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(RETURN_GAP_MS);
    live.returned();
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it('two re-reads at the same time share one', async () => {
    const { fake } = client();
    const live = open(fake);
    await Promise.all([live.refreshAll(), live.refreshAll()]);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('a socket that died in the background reconnects on return, with one channel only', async () => {
    const { fake, status } = client();
    const live = open(fake);
    status('SUBSCRIBED');
    status('CLOSED');
    live.returned();
    await vi.advanceTimersByTimeAsync(0);
    expect(fake.channel).toHaveBeenCalledTimes(2);
    expect(fake.removeChannel).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('many failures never leave two channels joined', async () => {
    const { fake, status } = client();
    open(fake);
    for (let i = 0; i < 4; i++) {
      status('CHANNEL_ERROR');
      await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS * 40);
    }
    const joined = vi.mocked(fake.channel).mock.calls.length;
    expect(vi.mocked(fake.removeChannel).mock.calls.length).toBe(joined - 1);
  });

  it('a client that rejoins by itself cancels the waiting reconnect', async () => {
    const { fake, status } = client();
    open(fake);
    status('CHANNEL_ERROR');
    status('SUBSCRIBED');
    await vi.advanceTimersByTimeAsync(RECONNECT_BASE_MS * 40);
    expect(fake.channel).toHaveBeenCalledTimes(1);
  });
});
