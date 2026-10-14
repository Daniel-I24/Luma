import { describe, it, expect, vi } from 'vitest';
import type { AuthResult } from '@core/auth/auth.service';
import { AuthFormSubmission } from './auth-form-submission';

const validForm = { invalid: false };

describe('AuthFormSubmission', () => {
  it('does nothing when the form is invalid', async () => {
    const submission = new AuthFormSubmission();
    const action = vi.fn();

    await submission.run({ invalid: true }, action, vi.fn());

    expect(action).not.toHaveBeenCalled();
  });

  it('runs the success handler and keeps no error on success', async () => {
    const submission = new AuthFormSubmission();
    const onSuccess = vi.fn();

    await submission.run(validForm, () => Promise.resolve({ success: true }), onSuccess);

    expect(onSuccess).toHaveBeenCalledOnce();
    expect(submission.errorKey()).toBeNull();
  });

  it('exposes the error key on failure without calling the success handler', async () => {
    const submission = new AuthFormSubmission();
    const onSuccess = vi.fn();
    const failure: AuthResult = { success: false, errorKey: 'auth.errors.invalidCredentials' };

    await submission.run(validForm, () => Promise.resolve(failure), onSuccess);

    expect(onSuccess).not.toHaveBeenCalled();
    expect(submission.errorKey()).toBe('auth.errors.invalidCredentials');
  });

  it('falls back to the unknown error key', async () => {
    const submission = new AuthFormSubmission();

    await submission.run(validForm, () => Promise.resolve({ success: false }), vi.fn());

    expect(submission.errorKey()).toBe('auth.errors.unknown');
  });

  it('clears the previous error when submitting again', async () => {
    const submission = new AuthFormSubmission();
    await submission.run(validForm, () => Promise.resolve({ success: false }), vi.fn());

    await submission.run(validForm, () => Promise.resolve({ success: true }), vi.fn());

    expect(submission.errorKey()).toBeNull();
  });

  it('is submitting only while the action is in flight', async () => {
    const submission = new AuthFormSubmission();
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

  it('resets the submitting state when the action throws', async () => {
    const submission = new AuthFormSubmission();

    await expect(
      submission.run(validForm, () => Promise.reject(new Error('network')), vi.fn()),
    ).rejects.toThrow('network');

    expect(submission.submitting()).toBe(false);
  });
});
