import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthCodeService } from '@core/auth/auth-code.service';
import { AuthService } from '@core/auth/auth.service';
import { PendingVerification } from '@core/auth/pending-verification';
import { LumaButton, LumaCard, LumaInput } from '@design-system';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { AuthFormSubmission } from '../../forms/auth-form-submission';

/**
 * LoginPage — /auth/login
 * Handles user sign-in with email and password. An unconfirmed account is
 * offered a new code and taken to /auth/verify.
 */
@Component({
  selector: 'app-login-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoModule, LumaButton, LumaCard, LumaInput],
  templateUrl: './login.page.html',
  styleUrl: './login.page.css',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly sessionProfile = inject(SessionProfileStore);
  private readonly fb = inject(FormBuilder);
  private readonly codes = inject(AuthCodeService);
  private readonly pending = inject(PendingVerification);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected readonly submission = new AuthFormSubmission();
  protected readonly resend = new AuthFormSubmission();
  protected readonly unconfirmed = computed(
    () => this.submission.errorKey() === 'auth.errors.emailNotConfirmed',
  );

  protected onSubmit(): Promise<void> {
    const { email, password } = this.form.getRawValue();
    return this.submission.run(
      this.form,
      () => this.auth.signIn(email, password),
      () => this.goHome(),
    );
  }

  /** Sends a new code to the unconfirmed email and opens the code screen. */
  protected verifyEmail(): Promise<void> {
    const { email } = this.form.getRawValue();
    return this.resend.run(
      this.form,
      () => this.codes.resendSignupCode(email),
      () => {
        this.pending.set(email);
        return this.router.navigate(['/auth/verify']);
      },
    );
  }

  /** Lands on the home of the account type (customers: /map). */
  private async goHome(): Promise<boolean> {
    return this.router.navigateByUrl(await this.sessionProfile.landingPath());
  }
}
