import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, ToastService } from '@design-system';
import { NotificationPreferencesRepository } from '@shared/notifications/notification-preferences.repository';

/**
 * DeviceTest — "Probar mi dispositivo" for admins: a test notice to the
 * admin's own account (send_test_notification, admins only, 3 a day) that
 * push-dispatch sends to their phone, to check the whole chain
 * (docs/push-setup.md).
 */
@Component({
  selector: 'app-device-test',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton],
  template: `
    <section *transloco="let t" class="flex flex-col gap-2" aria-labelledby="ops-device">
      <h2 id="ops-device" class="m-0 text-title text-fg">{{ t('admin.operations.device') }}</h2>
      <p class="m-0 text-body-sm text-fg-muted">{{ t('notificationSettings.test.hint') }}</p>
      <app-luma-button variant="secondary" [disabled]="testing()" (clicked)="send()">
        {{ t(testing() ? 'notificationSettings.test.sending' : 'notificationSettings.test.send') }}
      </app-luma-button>
    </section>
  `,
})
export class DeviceTest {
  private readonly repo = inject(NotificationPreferencesRepository);
  private readonly toast = inject(ToastService);
  protected readonly testing = signal(false);

  protected async send(): Promise<void> {
    if (this.testing()) return;
    this.testing.set(true);
    const result = await this.repo.sendTest();
    this.testing.set(false);
    this.toast.show(result.errorKey
      ? { messageKey: result.errorKey, tone: 'error' }
      : { messageKey: 'notificationSettings.test.sent', tone: 'success' });
  }
}
