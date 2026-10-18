import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { MIN_PASSWORD_LENGTH, PASSWORD_PATTERN } from '@core/auth/auth.schemas';
import { PendingVerification } from '@core/auth/pending-verification';
import { LumaButton, LumaCard, LumaInput } from '@design-system';
import { AuthFormSubmission } from '../../forms/auth-form-submission';

/**
 * RegisterPage — /auth/register
 * Creates the account, then asks for the emailed code (/auth/verify).
 */
@Component({
  selector: 'app-register-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoModule, LumaButton, LumaCard, LumaInput],
  templateUrl: './register.page.html',
  styleUrl: './register.page.css',
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly pending = inject(PendingVerification);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(MIN_PASSWORD_LENGTH),
        Validators.pattern(PASSWORD_PATTERN),
      ],
    ],
  });

  protected readonly submission = new AuthFormSubmission();

  protected onSubmit(): Promise<void> {
    const { email, password } = this.form.getRawValue();
    return this.submission.run(
      this.form,
      () => this.auth.signUp(email, password),
      () => this.onRegistered(),
    );
  }

  /** The same next step whether or not the email already had an account. */
  private async onRegistered(): Promise<void> {
    this.pending.set(this.form.controls.email.value);
    await this.router.navigate(['/auth/verify']);
  }
}
