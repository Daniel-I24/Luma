import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppEvents } from '@core/native/app-events';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { RealtimeEvent } from './realtime.model';
import { REALTIME_BATCH_MS, REALTIME_POLL_MS } from './realtime-subscription';
import { RealtimeService } from './realtime.service';

/** A Supabase client whose channels are driven by the test. */
function fakeClient() {
  const channels: { name: string; table: string; emit: (e: RealtimeEvent) => void; status: (s: string) => void }[] = [];
  const client = {
    removeChannel: vi.fn(),
    channel: vi.fn((name: string) => {
      const entry: { name: string; table: string; emit: (e: RealtimeEvent) => void; status: (s: string) => void } = {
        name, table: '', emit: () => undefined, status: () => undefined,
      };
      channels.push(entry);
      const channel = {
        on: (_: string, filter: { table: string }, callback: (payload: { new: RealtimeEvent }) => void) => {
          entry.table = filter.table;
          entry.emit = (event) => callback({ new: event });
          return channel;
        },
        subscribe: (callback: (status: string) => void) => {
          entry.status = callback;
          return channel;
        },
      };
      return channel;
    }),
  };
  return { client, channels, last: () => channels[channels.length - 1]! };
}

const refresh = vi.fn();

@Component({ template: '' })
class Screen {
  public readonly live = inject(RealtimeService).watch('catalog_events', refresh, (e) => e.business_id !== 'other');
}

describe('RealtimeService', () => {
  let fake: ReturnType<typeof fakeClient>;
  const online = signal(true);
  const resumes = signal(0);

  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockReset();
    online.set(true);
    fake = fakeClient();
    TestBed.configureTestingModule({
      providers: [
        // The real service (every other spec gets FakeRealtimeService, src/test-providers.ts).
        RealtimeService,
        { provide: SupabaseService, useValue: { client: fake.client } },
        { provide: ConnectivityService, useValue: { online } },
        { provide: AppEvents, useValue: { resumes } },
      ],
    });
  });
  afterEach(() => vi.useRealTimers());

  function open() {
    const fixture = TestBed.createComponent(Screen);
    fixture.detectChanges();
    return fixture;
  }

  it('subscribes to INSERTs of its table on entering and leaves on destroy', () => {
    const fixture = open();
    expect(fake.last().table).toBe('catalog_events');
    fixture.destroy();
    expect(fake.client.removeChannel).toHaveBeenCalledTimes(1);
    fake.last().emit({ business_id: 'b1' });
    vi.advanceTimersByTime(REALTIME_BATCH_MS);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('groups the events of 500 ms into one refresh and drops irrelevant ones', () => {
    open();
    fake.last().status('SUBSCRIBED');
    fake.last().emit({ kind: 'menu', business_id: 'b1' });
    fake.last().emit({ kind: 'hours', business_id: 'other' });
    fake.last().emit({ kind: 'promotion', business_id: 'b2' });
    vi.advanceTimersByTime(REALTIME_BATCH_MS - 1);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith([{ kind: 'menu', business_id: 'b1' }, { kind: 'promotion', business_id: 'b2' }]);
  });

  it('a failed channel polls every 30 s and reconnects with a growing wait; SUBSCRIBED stops the polling', () => {
    const fixture = open();
    fake.last().status('CHANNEL_ERROR');
    expect(fixture.componentInstance.live.live()).toBe(false);
    vi.advanceTimersByTime(1500);
    expect(fake.client.channel).toHaveBeenCalledTimes(2);
    fake.last().status('TIMED_OUT');
    vi.advanceTimersByTime(REALTIME_POLL_MS);
    expect(refresh).toHaveBeenCalledWith([]);
    expect(fake.client.channel).toHaveBeenCalledTimes(3);
    fake.last().status('SUBSCRIBED');
    refresh.mockReset();
    vi.advanceTimersByTime(REALTIME_POLL_MS * 2);
    expect(refresh).not.toHaveBeenCalled();
    expect(fixture.componentInstance.live.live()).toBe(true);
  });

  it('the CLOSED of a channel it left is not a failure', () => {
    open();
    const first = fake.last();
    first.status('CHANNEL_ERROR');
    vi.advanceTimersByTime(1500);
    first.status('CLOSED');
    vi.advanceTimersByTime(REALTIME_POLL_MS);
    expect(fake.client.channel).toHaveBeenCalledTimes(2);
  });

  it('the network back reconnects at once and refreshes everything; so does coming back to the foreground', () => {
    open();
    online.set(false);
    TestBed.tick();
    online.set(true);
    TestBed.tick();
    expect(fake.client.channel).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledWith([]);
    refresh.mockReset();
    resumes.update((n) => n + 1);
    TestBed.tick();
    expect(refresh).toHaveBeenCalledWith([]);
  });

  it('a refresh that fails keeps the last update time', async () => {
    const fixture = open();
    const before = fixture.componentInstance.live.updatedAt();
    refresh.mockRejectedValueOnce(new Error('offline'));
    await fixture.componentInstance.live.refreshAll();
    expect(fixture.componentInstance.live.updatedAt()).toBe(before);
    vi.setSystemTime(Date.now() + 60_000);
    refresh.mockResolvedValueOnce(undefined);
    await fixture.componentInstance.live.refreshAll();
    expect(fixture.componentInstance.live.updatedAt()!.getTime()).toBeGreaterThan(before!.getTime());
  });
});
