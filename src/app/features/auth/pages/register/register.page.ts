import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { LumaButton, LumaCard, LumaInput } from '@design-system';
import { AuthFormSubmission } from '../../forms/auth-form-submission';

/**
 * RegisterPage — /auth/register
 * Handles new user registration.
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

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected readonly submission = new AuthFormSubmission();
  protected readonly success = signal(false);

  protected onSubmit(): Promise<void> {
    const { email, password } = this.form.getRawValue();
    return this.submission.run(
      this.form,
      () => this.auth.signUp(email, password),
      () => this.onRegistered(),
    );
  }

  private async onRegistered(): Promise<void> {
    if (this.auth.user() !== null) {
      await this.router.navigate(['/map']);
    } else {
      // Email confirmation pending: no session yet.
      this.success.set(true);
    }
  }
}
