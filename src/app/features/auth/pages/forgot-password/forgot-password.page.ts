import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AuthRules } from '@core/validation/auth-rules';
import { ContactRules } from '@core/validation/contact-rules';
import { ValidatedField } from '@core/validation/validated-field';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthCodeService } from '@core/auth/auth-code.service';
import { CODE_LENGTH, AuthCode } from '@core/auth/auth.schemas';
import { LumaButton, LumaCard, LumaInput } from '@design-system';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { AuthFormSubmission } from '../../forms/auth-form-submission';

type Step = 'email' | 'code';

/**
 * ForgotPasswordPage — /auth/forgot-password: asks for the email, emails a
 * 6-digit code, then takes the code and the new password and signs in. The
 * same confirmation is shown whether or not the email has an account.
 */
@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoModule, LumaButton, LumaCard, LumaInput],
  templateUrl: './forgot-password.page.html',
  styleUrl: './forgot-password.page.css',
})
export class ForgotPasswordPage {
  private readonly codes = inject(AuthCodeService);
  private readonly router = inject(Router);
  private readonly sessionProfile = inject(SessionProfileStore);

  protected readonly step = signal<Step>('email');
  protected readonly email = signal('');
  protected readonly code = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly codeLength = CODE_LENGTH;
  protected readonly emailField = new ValidatedField(ContactRules.email, { value: this.email });
  protected readonly codeField = new ValidatedField(AuthRules.code, { value: this.code });
  protected readonly passwordField = new ValidatedField(AuthRules.newPassword, { value: this.password });
  protected readonly submission = new AuthFormSubmission();

  protected onCode(value: string): void {
    this.code.set(AuthCode.normalizeCode(value));
  }

  protected requestCode(event: Event): Promise<void> {
    event.preventDefault();
    return this.submission.run(
      { invalid: !this.emailField.validate() },
      () => this.codes.requestRecoveryCode(this.email()),
      () => this.step.set('code'),
    );
  }

  protected recover(event: Event): Promise<void> {
    event.preventDefault();
    return this.submission.run(
      { invalid: ![this.codeField.validate(), this.passwordField.validate()].every(Boolean) },
      () => this.codes.recoverPassword(this.email(), this.code(), this.password()),
      () => this.goHome(),
    );
  }

  /** Lands on the home of the account type (customers: /map). */
  private async goHome(): Promise<boolean> {
    return this.router.navigateByUrl(await this.sessionProfile.landingPath());
  }
}
