import { inject, signal } from '@angular/core';
import type { AbstractControl } from '@angular/forms';
import { type AuthResult, AuthResults } from '@core/auth/auth-error';
import { ErrorLog } from '@core/errors/error-log';

const UNKNOWN_ERROR_KEY = 'auth.errors.unknown';
const NEXT_STEP_ERROR_KEY = 'auth.errors.nextStepFailed';

/**
 * AuthFormSubmission — submit flow shared by the auth pages (composed, not
 * inherited; created in a field of the page): skips invalid forms, tracks the
 * in-flight state and exposes the i18n key of the last error. Nothing rejects:
 * a failure of the action or of the next step is shown on the form and logged.
 */
export class AuthFormSubmission {
  private readonly log = inject(ErrorLog);
  private readonly _submitting = signal(false);
  private readonly _errorKey = signal<string | null>(null);

  public readonly submitting = this._submitting.asReadonly();
  public readonly errorKey = this._errorKey.asReadonly();

  /** Runs an auth action once at a time, exposing its submitting state and error key. */
  public async run(
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
    } catch (error) {
      this.log.record(error, 'auth');
      result = AuthResults.fail(UNKNOWN_ERROR_KEY);
    } finally {
      this._submitting.set(false);
    }

    if (!result.success) {
      this._errorKey.set(result.errorKey ?? UNKNOWN_ERROR_KEY);
      return;
    }
    try {
      await onSuccess();
    } catch (error) {
      this.log.record(error, 'auth');
      this._errorKey.set(NEXT_STEP_ERROR_KEY);
    }
  }
}
