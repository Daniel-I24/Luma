import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { createFakeSupabase, failure, ok } from '../../../testing/fake-supabase';
import type { FakeResponse } from '../../../testing/fake-supabase';
import { NotificationRepository } from './notification.repository';
import { UnreadNotifications } from './unread-notifications';

function setup(responses: Record<string, FakeResponse>) {
  const fake = createFakeSupabase(responses);
  TestBed.configureTestingModule({
    providers: [{ provide: SupabaseService, useValue: fake }, UnreadNotifications],
  });
  return { repo: TestBed.inject(NotificationRepository), fake };
}

describe('NotificationRepository', () => {
  it('lists the newest first and finds the business of new orders', async () => {
    const { repo, fake } = setup({
      notifications: ok([
        { id: 'n1', type: 'order_new', order_id: 'o1', status: 'pending' },
        { id: 'n2', type: 'order_status', order_id: 'o2', status: 'ready' },
      ]),
      business_orders: ok([{ id: 'o1', business_id: 'b1' }]),
    });

    const result = await repo.list();

    expect(result.data?.map((n) => n.business_id)).toEqual(['b1', null]);
    expect(fake.queries[0].call('order')).toEqual(['created_at', { ascending: false }]);
    expect(fake.queries[1].call('in')).toEqual(['id', ['o1']]);
  });

  it('counts unread with a HEAD request and marks only unread as read', async () => {
    const { repo, fake } = setup({ notifications: { data: null, error: null, count: 3 } });

    expect(await repo.unreadCount()).toEqual({ data: 3, errorKey: null });
    expect(fake.queries[0].call('select')).toEqual(['id', { count: 'exact', head: true }]);
    expect(fake.queries[0].call('is')).toEqual(['read_at', null]);

    const now = new Date('2026-10-14T12:00:00Z');
    await repo.markAllRead(now);
    expect(fake.queries[1].call('update')).toEqual([{ read_at: now.toISOString() }]);
    expect(fake.queries[1].call('is')).toEqual(['read_at', null]);
  });

  it('maps errors and keeps the last count on failure', async () => {
    const { repo } = setup({ notifications: failure() });
    expect((await repo.list()).errorKey).toBe('notifications.errors.loadFailed');

    const unread = TestBed.inject(UnreadNotifications);
    await unread.refresh();
    expect(unread.count()).toBe(0);
  });
});
