import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { LumaButton, LumaCard, LumaInput } from '@design-system';

/**
 * ForgotPasswordPage — /auth/forgot-password
 * Sends a password-reset email via Supabase.
 */
@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoModule, LumaButton, LumaCard, LumaInput],
  templateUrl: './forgot-password.page.html',
  styleUrl: './forgot-password.page.css',
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected readonly loading = this.auth.loading;
  protected readonly errorKey = signal<string | null>(null);
  protected readonly success = signal(false);

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.errorKey.set(null);

    const { email } = this.form.getRawValue();
    const result = await this.auth.resetPassword(email);

    if (result.success) {
      this.success.set(true);
    } else {
      this.errorKey.set(result.errorKey ?? 'auth.errors.unknown');
    }
  }
}
