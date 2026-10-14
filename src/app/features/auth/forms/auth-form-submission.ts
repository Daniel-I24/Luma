import { signal } from '@angular/core';
import type { AbstractControl } from '@angular/forms';
import type { AuthResult } from '@core/auth/auth.service';

const UNKNOWN_ERROR_KEY = 'auth.errors.unknown';

/**
 * AuthFormSubmission — submit flow shared by the auth pages (composed, not
 * inherited): skips invalid forms, tracks the in-flight state and exposes the
 * i18n key of the last error.
 */
export class AuthFormSubmission {
  private readonly _submitting = signal(false);
  private readonly _errorKey = signal<string | null>(null);

  readonly submitting = this._submitting.asReadonly();
  readonly errorKey = this._errorKey.asReadonly();

  async run(
    form: Pick<AbstractControl, 'invalid'>,
    action: () => Promise<AuthResult>,
    onSuccess: () => unknown,
  ): Promise<void> {
    if (form.invalid) return;
    this._errorKey.set(null);

    this._submitting.set(true);
    let result: AuthResult;
    try {
      result = await action();
    } finally {
      this._submitting.set(false);
    }

    if (result.success) {
      await onSuccess();
    } else {
      this._errorKey.set(result.errorKey ?? UNKNOWN_ERROR_KEY);
    }
  }
}
