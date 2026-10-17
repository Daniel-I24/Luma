import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaButton, LumaEmptyState, LumaIcon, LumaIconButton, LumaSkeleton } from '@design-system';
import { formatDateTime } from '@shared/format/date-format.util';
import type { AppNotification } from '@shared/notifications/notification.repository';
import { pollWhileVisible } from '@shared/ui/poll-while-visible';
import { NotificationsStore } from './state/notifications.store';
import { notificationKey, notificationLink } from './utils/notification-view.util';

/** Refresh period while the screen is visible. */
export const NOTIFICATIONS_REFRESH_MS = 30_000;

/**
 * NotificationsPage — /notifications (from Profile): order notifications,
 * newest first; opening marks them as read; tapping one opens its order.
 */
@Component({
  selector: 'app-notifications-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaEmptyState, LumaIcon, LumaIconButton, LumaSkeleton],
  providers: [NotificationsStore],
  templateUrl: './notifications.page.html',
  host: { class: 'block' },
})
export class NotificationsPage {
  protected readonly store = inject(NotificationsStore);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  protected readonly textKey = notificationKey;

  constructor() {
    void this.store.load();
    pollWhileVisible(() => void this.store.refresh(), NOTIFICATIONS_REFRESH_MS);
  }

  protected when(notification: AppNotification): string {
    return formatDateTime(notification.created_at, this.lang());
  }

  protected canOpen(notification: AppNotification): boolean {
    return notificationLink(notification) !== null;
  }

  protected open(notification: AppNotification): void {
    const link = notificationLink(notification);
    if (link) void this.router.navigate(link);
  }

  protected back(): void {
    void this.router.navigate(['/profile']);
  }
}
