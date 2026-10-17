import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationRepository } from '@shared/notifications/notification.repository';
import { UnreadNotifications } from '@shared/notifications/unread-notifications';
import { NOTIFICATIONS_REFRESH_MS, NotificationsPage } from './notifications.page';
import { notificationKey, notificationLink } from './utils/notification-view.util';

const flush = () => new Promise((resolve) => setTimeout(resolve));
const base = { created_at: '2026-10-14T12:00:00Z', business_id: null };

describe('NotificationsPage', () => {
  const repo = { list: vi.fn(), markAllRead: vi.fn(), unreadCount: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.list.mockResolvedValue({
      data: [
        { ...base, id: 'n1', type: 'order_status', order_id: 'o1', status: 'ready', read_at: null },
        {
          ...base,
          id: 'n2',
          type: 'order_new',
          order_id: 'o2',
          status: 'pending',
          read_at: 'x',
          business_id: 'b1',
        },
      ],
      errorKey: null,
    });
    repo.markAllRead.mockResolvedValue({ data: true, errorKey: null });
    repo.unreadCount.mockResolvedValue({ data: 1, errorKey: null });
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideRouter([]),
        UnreadNotifications,
        { provide: NotificationRepository, useValue: repo },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  async function render() {
    const fixture = TestBed.createComponent(NotificationsPage);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('builds the text from type and status and marks the unread ones', async () => {
    const unread = TestBed.inject(UnreadNotifications);
    await unread.refresh();
    const { el } = await render();

    const items = el.querySelectorAll('li');
    expect(items[0].textContent).toContain('notifications.text.status.ready');
    expect(items[0].textContent).toContain('notifications.new');
    expect(items[1].textContent).toContain('notifications.text.orderNew');
    expect(items[1].textContent).not.toContain('notifications.new');
    expect(repo.markAllRead).toHaveBeenCalledOnce();
    expect(unread.count()).toBe(0);
  });

  it('opens the order of a notification', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { el } = await render();

    el.querySelectorAll('li button')[0].dispatchEvent(new Event('click'));
    el.querySelectorAll('li button')[1].dispatchEvent(new Event('click'));

    expect(navigate).toHaveBeenNthCalledWith(1, ['/orders', 'o1']);
    expect(navigate).toHaveBeenNthCalledWith(2, ['/business', 'b1', 'orders']);
  });

  it(`refreshes every ${NOTIFICATIONS_REFRESH_MS / 1000} s while visible`, async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await render();
    repo.list.mockClear();

    vi.advanceTimersByTime(NOTIFICATIONS_REFRESH_MS * 2);

    expect(repo.list).toHaveBeenCalledTimes(2);
  });

  it('shows the empty state', async () => {
    repo.list.mockResolvedValue({ data: [], errorKey: null });
    const { el } = await render();

    expect(el.textContent).toContain('notifications.empty.title');
    expect(repo.markAllRead).not.toHaveBeenCalled();
  });
});

describe('notification view', () => {
  it('maps every status to a key and links owners to their board', () => {
    expect(notificationKey({ type: 'order_status', status: 'cancelled' })).toBe(
      'notifications.text.status.cancelled',
    );
    expect(notificationKey({ type: 'order_status', status: null })).toBe(
      'notifications.text.status.unknown',
    );
    const orphan = {
      ...base,
      id: 'n',
      type: 'order_new',
      order_id: 'o',
      status: null,
      read_at: null,
    } as const;
    expect(notificationLink(orphan)).toEqual(['/business']);
    expect(notificationLink({ ...orphan, type: 'order_status', order_id: null })).toBeNull();
  });
});
