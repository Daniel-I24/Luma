import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaButton, LumaEmptyState, LumaIcon, LumaIconButton, LumaSkeleton } from '@design-system';
import { DateFormat } from '@shared/format/date-format';
import type { AppNotification } from '@shared/notifications/notification.repository';
import { RealtimeService } from '@core/realtime/realtime.service';
import { NotificationsStore } from './state/notifications.store';
import { NotificationView } from './utils/notification-view';

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
  protected readonly textKey = NotificationView.notificationKey;

  constructor() {
    void this.store.load();
    // A new notice (order_events with no order: "your inbox changed"), as it arrives.
    inject(RealtimeService).watch('order_events', () => this.store.refresh(), (event) => !event.order_id);
  }

  protected when(notification: AppNotification): string {
    return DateFormat.formatDateTime(notification.created_at, this.lang());
  }

  protected canOpen(notification: AppNotification): boolean {
    return NotificationView.notificationLink(notification) !== null;
  }

  protected open(notification: AppNotification): void {
    const link = NotificationView.notificationLink(notification);
    if (link) void this.router.navigate(link);
  }

  protected back(): void {
    void this.router.navigate(['/profile']);
  }
}
