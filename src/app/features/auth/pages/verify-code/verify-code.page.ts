import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthCodeService } from '@core/auth/auth-code.service';
import { CODE_LENGTH, normalizeCode } from '@core/auth/auth.schemas';
import { PendingVerification } from '@core/auth/pending-verification';
import { LumaButton, LumaCard, LumaInput } from '@design-system';
import { createCountdown } from '@shared/ui/countdown';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { AuthFormSubmission } from '../../forms/auth-form-submission';

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
  styleUrl: '../../auth-page.css',
})
export class VerifyCodePage {
  private readonly codes = inject(AuthCodeService);
  private readonly pending = inject(PendingVerification);
  private readonly router = inject(Router);
  private readonly sessionProfile = inject(SessionProfileStore);

  protected readonly knownEmail = this.pending.email;
  protected readonly email = signal(this.pending.email() ?? '');
  protected readonly code = signal('');
  protected readonly submission = new AuthFormSubmission();
  protected readonly resend = new AuthFormSubmission();
  protected readonly resent = signal(false);
  protected readonly cooldown = createCountdown();
  protected readonly codeLength = CODE_LENGTH;
  protected readonly complete = computed(() => this.code().length === CODE_LENGTH);

  constructor() {
    // A code was just sent (sign-up or "verify my email" on the login page).
    if (this.knownEmail()) this.cooldown.start(RESEND_COOLDOWN_SECONDS);
  }

  protected onCode(value: string): void {
    this.code.set(normalizeCode(value));
    if (this.complete()) void this.verify();
  }

  protected verify(): Promise<void> {
    return this.submission.run(
      { invalid: !this.complete() || this.email().trim() === '' },
      () => this.codes.confirmSignup(this.email(), this.code()),
      () => {
        this.pending.clear();
        return this.goHome();
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

  /** Lands on the home of the account type (customers: /map). */
  private async goHome(): Promise<boolean> {
    return this.router.navigateByUrl(await this.sessionProfile.landingPath());
  }
}
