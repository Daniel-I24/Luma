import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { LumaButton, LumaCard, LumaInput } from '@design-system';

/**
 * LoginPage — /auth/login
 * Handles user sign-in with email and password.
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
  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected readonly loading = this.auth.loading;
  protected readonly errorKey = signal<string | null>(null);

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.errorKey.set(null);

    const { email, password } = this.form.getRawValue();
    const result = await this.auth.signIn(email, password);

    if (result.success) {
      await this.router.navigate(['/profile']);
    } else {
      this.errorKey.set(result.errorKey ?? 'auth.errors.unknown');
    }
  }
}
