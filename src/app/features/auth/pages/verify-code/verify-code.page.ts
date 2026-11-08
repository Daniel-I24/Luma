import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ContactRules } from '@core/validation/contact-rules';
import { ValidatedField } from '@core/validation/validated-field';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthCodeService } from '@core/auth/auth-code.service';
import { CODE_LENGTH, AuthCode } from '@core/auth/auth.schemas';
import { PendingVerification } from '@core/auth/pending-verification';
import { LumaButton, LumaCard, LumaInput } from '@design-system';
import { Countdown } from '@shared/ui/countdown';
import { LandingNavigation } from '@shared/account/landing-navigation';
import { AuthFormSubmission } from '../../forms/auth-form-submission';
import { SignupCompletion } from '../../signup/signup-completion';

/** Seconds before another code can be requested. */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * VerifyCodePage — /auth/verify: "Escribe tu código". Confirms a new account
 * with the 6-digit code from the email (typed or pasted; sent as soon as it
 * is complete) and offers to resend it every 60 s.
 */
@Component({
  selector: 'app-verify-code-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoModule, LumaButton, LumaCard, LumaInput],
  templateUrl: './verify-code.page.html',
})
export class VerifyCodePage {
  private readonly codes = inject(AuthCodeService);
  private readonly pending = inject(PendingVerification);
  private readonly landing = inject(LandingNavigation);
  private readonly completion = inject(SignupCompletion);

  protected readonly knownEmail = this.pending.email;
  protected readonly email = signal(this.pending.email() ?? '');
  protected readonly code = signal('');
  protected readonly emailField = new ValidatedField(ContactRules.email, { value: this.email });
  protected readonly submission = new AuthFormSubmission();
  protected readonly resend = new AuthFormSubmission();
  protected readonly resent = signal(false);
  protected readonly cooldown = Countdown.createCountdown();
  protected readonly codeLength = CODE_LENGTH;
  protected readonly complete = computed(() => this.code().length === CODE_LENGTH);

  constructor() {
    // A code was just sent (sign-up or "verify my email" on the login page).
    if (this.knownEmail()) this.cooldown.start(RESEND_COOLDOWN_SECONDS);
  }

  protected onCode(value: string): void {
    this.code.set(AuthCode.normalizeCode(value));
    if (this.complete()) void this.verify();
  }

  protected verify(): Promise<void> {
    return this.submission.run(
      { invalid: !this.complete() || !this.emailField.validate() },
      () => this.codes.confirmSignup(this.email(), this.code()),
      async () => {
        this.pending.clear();
        // Residence and photo from the sign-up; a failure is fixed later in "Mis datos".
        await this.completion.complete();
        return this.landing.goHome();
      },
    );
  }

  protected resendCode(): Promise<void> {
    this.resent.set(false);
    return this.resend.run(
      { invalid: this.cooldown.remaining() > 0 || this.email().trim() === '' },
      () => this.codes.resendSignupCode(this.email()),
      () => {
        this.resent.set(true);
        this.cooldown.start(RESEND_COOLDOWN_SECONDS);
      },
    );
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void this.verify();
  }
}
