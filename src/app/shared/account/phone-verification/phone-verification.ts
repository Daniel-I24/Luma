import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaInput } from '@design-system';
import { PHONE_VERIFICATION_ENABLED } from '@core/config/features';
import type { Phone } from '../phone';
import { PhoneVerificationService } from '../phone-verification.service';

/**
 * PhoneVerification — "Verificar celular" in Mis datos: sends an SMS code to
 * the mobile and checks it. Renders nothing while the feature is off.
 */
@Component({
  selector: 'app-phone-verification',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaInput],
  template: `
    @if (enabled && phone(); as mobile) {
      <section *transloco="let t" class="flex flex-col gap-3" aria-labelledby="phone-verification-title">
        <h2 id="phone-verification-title" class="m-0 text-title text-fg">{{ t('phoneVerification.title') }}</h2>
        @if (done()) {
          <p class="m-0 text-body text-success-fg" role="status">{{ t('phoneVerification.done') }}</p>
        } @else if (sent()) {
          <app-luma-input inputId="phone-code" inputMode="numeric" [label]="t('phoneVerification.code')"
            [value]="code()" (valueChange)="code.set($event)" />
          <app-luma-button [loading]="busy()" (clicked)="confirm(mobile)">{{ t('phoneVerification.confirm') }}</app-luma-button>
        } @else {
          <p class="m-0 text-body-sm text-fg-muted">{{ t('phoneVerification.intro') }}</p>
          <app-luma-button variant="secondary" [loading]="busy()" (clicked)="send(mobile)">{{ t('phoneVerification.send') }}</app-luma-button>
        }
        @if (errorKey(); as key) {
          <p class="m-0 text-body-sm text-danger-fg" role="alert">{{ t(key) }}</p>
        }
      </section>
    }
  `,
})
export class PhoneVerification {
  private readonly service = inject(PhoneVerificationService);
  protected readonly enabled = inject(PHONE_VERIFICATION_ENABLED);

  /** The saved mobile to verify (null while there is none). */
  public readonly phone = input<Phone | null>(null);

  protected readonly code = signal('');
  protected readonly sent = signal(false);
  protected readonly done = signal(false);
  protected readonly busy = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected async send(phone: Phone): Promise<void> {
    const error = await this.run(() => this.service.sendCode(phone));
    this.sent.set(error === null);
  }

  protected async confirm(phone: Phone): Promise<void> {
    const error = await this.run(() => this.service.confirm(phone, this.code()));
    this.done.set(error === null);
  }

  private async run(action: () => Promise<string | null>): Promise<string | null> {
    this.busy.set(true);
    this.errorKey.set(null);
    try {
      const error = await action();
      this.errorKey.set(error);
      return error;
    } finally {
      this.busy.set(false);
    }
  }
}
