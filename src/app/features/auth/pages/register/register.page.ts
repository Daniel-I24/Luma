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

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected readonly loading = this.auth.loading;
  protected readonly errorKey = signal<string | null>(null);
  protected readonly success = signal(false);

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.errorKey.set(null);

    const { email, password } = this.form.getRawValue();
    const result = await this.auth.signUp(email, password);

    if (result.success) {
      this.success.set(true);
    } else {
      this.errorKey.set(result.errorKey ?? 'auth.errors.unknown');
    }
  }
}
