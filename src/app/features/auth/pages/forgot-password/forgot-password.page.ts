import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthRules } from '@core/validation/auth-rules';
import { ContactRules } from '@core/validation/contact-rules';
import { PasswordRules } from '@core/validation/password-rules';
import { ValidatedField } from '@core/validation/validated-field';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { CODE_LENGTH, AuthCode } from '@core/auth/auth.schemas';
import { LumaButton, LumaCard, LumaInput, LumaNotice } from '@design-system';
import { PasswordChecklist } from '@shared/account/password-checklist/password-checklist';
import { LandingNavigation } from '@shared/account/landing-navigation';
import { RecoveryFlow } from './recovery-flow';

const STEP_NUMBER = { email: 1, code: 2, password: 3 } as const;

/**
 * ForgotPasswordPage — /auth/forgot-password in three steps (RecoveryFlow):
 * the e-mail, the 6-digit code (checked before anything else, with
 * "Reenviar código" after 60 s) and the new password with its confirmation
 * and the live PasswordChecklist. Then it signs in.
 */
@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoModule, LumaButton, LumaCard, LumaInput, LumaNotice, PasswordChecklist],
  providers: [RecoveryFlow],
  templateUrl: './forgot-password.page.html',
  styles: `
    @import '../../auth-page.css';
  `,
})
export class ForgotPasswordPage {
  private readonly landing = inject(LandingNavigation);
  protected readonly flow = inject(RecoveryFlow);

  protected readonly code = signal('');
  protected readonly password = signal('');
  protected readonly confirmation = signal('');
  protected readonly showPassword = signal(false);
  protected readonly resent = signal(false);
  protected readonly confirmTouched = signal(false);
  protected readonly codeLength = CODE_LENGTH;
  protected readonly stepNumber = computed(() => STEP_NUMBER[this.flow.step()]);
  protected readonly emailField = new ValidatedField(ContactRules.email, { value: this.flow.email });
  protected readonly codeField = new ValidatedField(AuthRules.code, { value: this.code });
  protected readonly passwordError = computed(() => PasswordRules.errorKey(this.password(), this.flow.email()));
  protected readonly mismatch = computed(() => this.confirmation() !== this.password());

  protected onCode(value: string): void {
    this.code.set(AuthCode.normalizeCode(value));
  }

  protected async requestCode(event: Event): Promise<void> {
    event.preventDefault();
    if (this.emailField.validate()) await this.flow.sendCode();
  }

  protected async resend(): Promise<void> {
    this.code.set('');
    this.resent.set(await this.flow.sendCode());
  }

  protected async verify(event: Event): Promise<void> {
    event.preventDefault();
    this.resent.set(false);
    if (this.codeField.validate()) await this.flow.verify(this.code());
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.confirmTouched.set(true);
    if (this.passwordError() || this.mismatch()) return;
    if (await this.flow.save(this.password())) await this.landing.goHome();
  }
}
