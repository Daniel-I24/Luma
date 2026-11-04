import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton } from '@design-system';
import { type PushProblem, PushRegistration } from '@core/push/push-registration.service';
import {
  type NotificationPreferences,
  NotificationPreferencesRepository,
} from '../notification-preferences.repository';

type PreferenceKey = keyof NotificationPreferences;

/**
 * NotificationSettings — what the user wants to hear about (orders and
 * reviews; promotions of saved businesses, opt-in) and, on the phone, the
 * system permission. Shared by the Profile and Luma Negocios. The test
 * notification is an admin tool since round 8 (DeviceTest).
 */
@Component({
  selector: 'app-notification-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton],
  templateUrl: './notification-settings.html',
})
export class NotificationSettings implements OnInit {
  private readonly repo = inject(NotificationPreferencesRepository);
  protected readonly push = inject(PushRegistration);

  protected readonly keys: readonly PreferenceKey[] = ['orders', 'promotions'];
  /** Translation key of each push problem (notificationSettings.phone.problem.*). */
  protected readonly problemKeys: Readonly<Record<PushProblem, string>> = {
    denied: 'denied',
    not_configured: 'notConfigured',
    registration_failed: 'registrationFailed',
    token_save_failed: 'tokenSaveFailed',
  };
  protected readonly preferences = signal<NotificationPreferences | null>(null);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly saving = signal(false);

  /** Loads the preferences and the push permission. */
  public async ngOnInit(): Promise<void> {
    const result = await this.repo.get();
    this.preferences.set(result.data);
    this.errorKey.set(result.errorKey);
  }

  protected async toggle(key: PreferenceKey, event: Event): Promise<void> {
    const current = this.preferences();
    if (!current || this.saving()) return;
    const next = { ...current, [key]: (event.target as HTMLInputElement).checked };
    this.saving.set(true);
    this.errorKey.set(null);
    const result = await this.repo.set(next);
    this.saving.set(false);
    if (result.errorKey) {
      this.errorKey.set(result.errorKey);
      (event.target as HTMLInputElement).checked = current[key];
      return;
    }
    this.preferences.set(next);
    // Turning something on is the moment to ask the phone for permission.
    if (next[key] && this.push.permission() === 'prompt') await this.push.enable();
  }

  protected enable(): Promise<unknown> {
    return this.push.enable();
  }
}
