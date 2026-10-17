import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIcon } from '@design-system';
import { UnreadNotifications } from '@shared/notifications/unread-notifications';

/** NotificationsEntry — Profile link to /notifications with the unread count. */
@Component({
  selector: 'app-notifications-entry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaIcon],
  templateUrl: './notifications-entry.html',
})
export class NotificationsEntry {
  private readonly unread = inject(UnreadNotifications, { optional: true });
  protected readonly count = computed(() => this.unread?.count() ?? 0);
}
