import { Injectable, inject, signal } from '@angular/core';
import {
  type AppNotification,
  NotificationRepository,
} from '@shared/notifications/notification.repository';
import { UnreadNotifications } from '@shared/notifications/unread-notifications';

export type NotificationsState = 'loading' | 'ready' | 'error';

/**
 * NotificationsStore — the list shown on /notifications. Opening (and each
 * refresh) marks what is shown as read; the items keep their "new" mark
 * until the next visit so the user still sees what arrived.
 */
@Injectable()
export class NotificationsStore {
  private readonly repo = inject(NotificationRepository);
  private readonly unread = inject(UnreadNotifications, { optional: true });

  private readonly _state = signal<NotificationsState>('loading');
  private readonly _items = signal<readonly AppNotification[]>([]);
  /** Ids that were unread when they were first shown. */
  private readonly _fresh = signal<ReadonlySet<string>>(new Set());
  readonly state = this._state.asReadonly();
  readonly items = this._items.asReadonly();
  readonly fresh = this._fresh.asReadonly();

  async load(): Promise<void> {
    this._state.set('loading');
    await this.refresh();
  }

  /** Re-reads the list; a failed background refresh keeps what is shown. */
  async refresh(): Promise<void> {
    const result = await this.repo.list();
    if (!result.data) {
      if (this._state() !== 'ready') this._state.set('error');
      return;
    }
    const unreadIds = result.data.filter((n) => !n.read_at).map((n) => n.id);
    this._items.set(result.data);
    this._fresh.update((fresh) => new Set([...fresh, ...unreadIds]));
    this._state.set('ready');
    if (unreadIds.length && (await this.repo.markAllRead()).data) this.unread?.clear();
  }
}
