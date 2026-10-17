import { Injectable, inject, signal } from '@angular/core';
import { NotificationRepository } from './notification.repository';

/**
 * UnreadNotifications — count behind the Profile tab badge. Provided by the
 * tab layout (which refreshes it while the app is visible), so the
 * notifications screen and the profile read the same value.
 */
@Injectable()
export class UnreadNotifications {
  private readonly repo = inject(NotificationRepository);
  private readonly _count = signal(0);
  readonly count = this._count.asReadonly();

  /** Re-reads the count; a failed refresh keeps the last value. */
  async refresh(): Promise<void> {
    const result = await this.repo.unreadCount();
    if (result.data !== null) this._count.set(result.data);
  }

  /** After the user opened the notifications. */
  clear(): void {
    this._count.set(0);
  }
}
