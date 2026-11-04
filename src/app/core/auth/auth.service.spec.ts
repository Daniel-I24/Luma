import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { authServiceHarness } from './auth.service.harness';

describe('AuthService', () => {
  const h = authServiceHarness();
  const { setup } = h;

  it('signIn: returns success on valid credentials', async () => {
    setup({
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: { user: { email_confirmed_at: '2026-10-01T00:00:00Z' } } },
        error: null,
      }),
    });

    const result = await h.service.signIn('user@example.com', 'password123');

    expect(result.success).toBe(true);
    expect(result.errorKey).toBeUndefined();
  });

  it('signIn: returns mapped error key on invalid credentials', async () => {
    setup({
      signInWithPassword: vi.fn().mockResolvedValue({
        error: { message: 'Invalid login credentials' },
      }),
    });

    const result = await h.service.signIn('user@example.com', 'wrongpass');

    expect(result.success).toBe(false);
    expect(result.errorKey).toBe('auth.errors.invalidCredentials');
  });

  it('signIn: a phone keyboard capital and a trailing space never break the email; the password is sent as typed', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { session: { user: { email_confirmed_at: '2026-10-01T00:00:00Z' } } },
      error: null,
    });
    setup({ signInWithPassword });

    await h.service.signIn('  Ana.Perez@Correo.COM ', ' clave con espacio ');

    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'ana.perez@correo.com', password: ' clave con espacio ' });
  });

  it('signIn: Supabase error codes become our own messages, never telling whether the email exists', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 }, 'auth.errors.invalidCredentials'],
      [{ code: 'email_not_confirmed', message: 'Email not confirmed', status: 400 }, 'auth.errors.emailNotConfirmed'],
      [{ code: 'over_request_rate_limit', message: 'Request rate limit reached', status: 429 }, 'auth.errors.tooManyRequests'],
      [{ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 }, 'errors.serviceUnavailable'],
      [{ code: 'user_not_found', message: 'User not found', status: 400 }, 'auth.errors.invalidCredentials'],
    ];
    for (const [error, key] of cases) {
      TestBed.resetTestingModule();
      setup({ signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error }) });
      expect((await h.service.signIn('user@example.com', 'x')).errorKey).toBe(key);
    }
  });

  it('signIn: returns validation error key for malformed email', async () => {
    setup();

    const result = await h.service.signIn('not-an-email', 'password123');

    expect(result.success).toBe(false);
    expect(result.errorKey).toBe('auth.validation.emailInvalid');
    expect(h.supabaseStub.client.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  // ── signUp ─────────────────────────────────────────────────────────────────
});
