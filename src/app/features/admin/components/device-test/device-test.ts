import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, ToastService } from '@design-system';
import { NotificationPreferencesRepository } from '@shared/notifications/notification-preferences.repository';
import { type PushHealth, PushHealthRepository } from '../../services/push-health.repository';

/** What each answer of the push server means (admin.operations.pushHealth.*). */
const HEALTH_KEY: Readonly<Record<number, string>> = {
  200: 'working',
  401: 'badSecret',
  404: 'notDeployed',
  503: 'noAccount',
};

/**
 * DeviceTest — "Probar mi dispositivo" for admins: a test notice to the admin's
 * own account (send_test_notification, admins only, 3 a day) that push-dispatch
 * sends to their phone. It says when the account has no phone linked, and what
 * the push server last answered (docs/push-setup.md).
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
      @if (health(); as state) {
        <p class="m-0 text-body-sm text-fg-muted" role="status">
          {{ t('admin.operations.pushHealth.' + healthKey(), { status: state.status }) }}
          {{ t('admin.operations.pushHealth.counts', { tokens: state.tokens, unsent: state.unsent }) }}
        </p>
        @if (state.status === 200 && state.body) {
          <p class="m-0 break-all text-caption text-fg-subtle">{{ state.body }}</p>
        }
      }
    </section>
  `,
})
export class DeviceTest implements OnInit {
  private readonly repo = inject(NotificationPreferencesRepository);
  private readonly pushHealth = inject(PushHealthRepository);
  private readonly toast = inject(ToastService);
  protected readonly testing = signal(false);
  protected readonly health = signal<PushHealth | null>(null);
  protected readonly healthKey = computed(() => {
    const status = this.health()?.status;
    if (status === null || status === undefined) return 'noCalls';
    return HEALTH_KEY[status] ?? 'other';
  });

  /** Reads the last answer of the push server. */
  public async ngOnInit(): Promise<void> {
    this.health.set(await this.pushHealth.read());
  }

  protected async send(): Promise<void> {
    if (this.testing()) return;
    this.testing.set(true);
    const result = await this.repo.sendTest();
    this.testing.set(false);
    const failure = result.errorKey ?? (result.data === false ? 'notificationSettings.test.noToken' : null);
    this.toast.show(failure
      ? { messageKey: failure, tone: 'error' }
      : { messageKey: 'notificationSettings.test.sent', tone: 'success' });
  }
}
