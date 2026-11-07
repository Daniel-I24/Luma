import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppEvents } from '@core/native/app-events';
import { RealtimeService } from '@core/realtime/realtime.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { OrderDetailPage } from './order-detail.page';
import { OrdersTesting } from './orders.harness';

const { repo, order, flush } = OrdersTesting;

/** A socket that joins at once, so the screen is live when the customer returns. */
function client() {
  const channel = {
    on: () => channel,
    subscribe: (callback: (status: string) => void) => {
      callback('SUBSCRIBED');
      return channel;
    },
  };
  const auth = { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }) };
  return { auth, channel: () => channel, removeChannel: () => Promise.resolve('ok') };
}

describe('OrderDetailPage: back from the payment page, without any link', () => {
  const resumes = signal(0);

  beforeEach(() => {
    OrdersTesting.configure();
    resumes.set(0);
    TestBed.overrideProvider(RealtimeService, { useFactory: () => new RealtimeService() });
    TestBed.overrideProvider(SupabaseService, { useValue: { client: client() } });
    TestBed.overrideProvider(AppEvents, { useValue: { resumes, onUrl: () => () => undefined } });
  });
  afterEach(() => vi.useRealTimers());

  it('re-reads the order once when the app returns: the server says how it went', async () => {
    repo.getById.mockResolvedValue({ data: order('awaiting_payment'), errorKey: null });
    const detail = TestBed.createComponent(OrderDetailPage);
    detail.detectChanges();
    await flush();
    detail.detectChanges();
    repo.getById.mockClear();

    repo.getById.mockResolvedValue({ data: order('pending'), errorKey: null });
    resumes.update((count) => count + 1);
    TestBed.tick();
    await flush();
    expect(repo.getById).toHaveBeenCalledTimes(1);
  });
});
