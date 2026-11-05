import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { ErrorLog } from '@core/errors/error-log';
import type { AuthResult } from '@core/auth/auth-error';
import { AuthFormSubmission } from './auth-form-submission';

const validForm = { invalid: false };
const create = (): AuthFormSubmission => TestBed.runInInjectionContext(() => new AuthFormSubmission());

describe('AuthFormSubmission', () => {
  it('an action that throws shows the unknown error, ends the loading state and is logged', async () => {
    const submission = create();
    await submission.run(validForm, () => Promise.reject(new Error('boom')), vi.fn());
    expect(submission.errorKey()).toBe('auth.errors.unknown');
    expect(submission.submitting()).toBe(false);
    expect(TestBed.inject(ErrorLog).entries()[0]).toMatchObject({ source: 'auth', message: 'boom' });
  });

  it('a failure right after signing in is shown on the form, never unhandled', async () => {
    const submission = create();
    const next = vi.fn().mockRejectedValue(new Error('Loading chunk 12 failed'));
    await expect(submission.run(validForm, () => Promise.resolve({ success: true }), next)).resolves.toBeUndefined();
    expect(submission.errorKey()).toBe('auth.errors.nextStepFailed');
    expect(TestBed.inject(ErrorLog).entries()[0]).toMatchObject({ source: 'auth' });
  });

  it('does nothing when the form is invalid', async () => {
    const submission = create();
    const action = vi.fn();

    await submission.run({ invalid: true }, action, vi.fn());

    expect(action).not.toHaveBeenCalled();
  });

  it('runs the success handler and keeps no error on success', async () => {
    const submission = create();
    const onSuccess = vi.fn();

    await submission.run(validForm, () => Promise.resolve({ success: true }), onSuccess);

    expect(onSuccess).toHaveBeenCalledOnce();
    expect(submission.errorKey()).toBeNull();
  });

  it('exposes the error key on failure without calling the success handler', async () => {
    const submission = create();
    const onSuccess = vi.fn();
    const failure: AuthResult = { success: false, errorKey: 'auth.errors.invalidCredentials' };

    await submission.run(validForm, () => Promise.resolve(failure), onSuccess);

    expect(onSuccess).not.toHaveBeenCalled();
    expect(submission.errorKey()).toBe('auth.errors.invalidCredentials');
  });

  it('falls back to the unknown error key', async () => {
    const submission = create();

    await submission.run(validForm, () => Promise.resolve({ success: false }), vi.fn());

    expect(submission.errorKey()).toBe('auth.errors.unknown');
  });

  it('clears the previous error when submitting again', async () => {
    const submission = create();
    await submission.run(validForm, () => Promise.resolve({ success: false }), vi.fn());

    await submission.run(validForm, () => Promise.resolve({ success: true }), vi.fn());

    expect(submission.errorKey()).toBeNull();
  });

  it('is submitting only while the action is in flight', async () => {
    const submission = create();
    let resolve!: (result: AuthResult) => void;
    const pending = submission.run(
      validForm,
      () => new Promise<AuthResult>((r) => (resolve = r)),
      vi.fn(),
    );

    expect(submission.submitting()).toBe(true);
    resolve({ success: true });
    await pending;

    expect(submission.submitting()).toBe(false);
  });
});
