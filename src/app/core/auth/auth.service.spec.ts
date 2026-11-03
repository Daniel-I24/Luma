import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { AuthService } from './auth.service';
import { SignUpMetadata } from './sign-up-profile';
import { SupabaseService } from '@core/supabase/supabase.service';

/** Creates a minimal SupabaseService stub with controllable auth responses. */
function makeSupabaseStub(overrides: Record<string, unknown> = {}) {
  return {
    client: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi
          .fn()
          .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        resetPasswordForEmail: vi.fn(),
        ...overrides,
      },
      functions: {
        invoke: vi.fn(),
      },
    },
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let supabaseStub: ReturnType<typeof makeSupabaseStub>;

  function setup(authOverrides: Record<string, unknown> = {}) {
    supabaseStub = makeSupabaseStub(authOverrides);
    TestBed.configureTestingModule({
      providers: [AuthService, { provide: SupabaseService, useValue: supabaseStub }],
    });
    service = TestBed.inject(AuthService);
  }

  // ── signIn ─────────────────────────────────────────────────────────────────

  it('signIn: returns success on valid credentials', async () => {
    setup({
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: { user: { email_confirmed_at: '2026-10-01T00:00:00Z' } } },
        error: null,
      }),
    });

    const result = await service.signIn('user@example.com', 'password123');

    expect(result.success).toBe(true);
    expect(result.errorKey).toBeUndefined();
  });

  it('signIn: returns mapped error key on invalid credentials', async () => {
    setup({
      signInWithPassword: vi.fn().mockResolvedValue({
        error: { message: 'Invalid login credentials' },
      }),
    });

    const result = await service.signIn('user@example.com', 'wrongpass');

    expect(result.success).toBe(false);
    expect(result.errorKey).toBe('auth.errors.invalidCredentials');
  });

  it('signIn: a phone keyboard capital and a trailing space never break the email; the password is sent as typed', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { session: { user: { email_confirmed_at: '2026-10-01T00:00:00Z' } } },
      error: null,
    });
    setup({ signInWithPassword });

    await service.signIn('  Ana.Perez@Correo.COM ', ' clave con espacio ');

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
      expect((await service.signIn('user@example.com', 'x')).errorKey).toBe(key);
    }
  });

  it('signIn: returns validation error key for malformed email', async () => {
    setup();

    const result = await service.signIn('not-an-email', 'password123');

    expect(result.success).toBe(false);
    expect(result.errorKey).toBe('auth.validation.emailInvalid');
    expect(supabaseStub.client.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  // ── signUp ─────────────────────────────────────────────────────────────────

  it('signUp: returns success for a new valid user', async () => {
    setup({
      signUp: vi.fn().mockResolvedValue({ error: null }),
    });

    const result = await service.signUp('newuser@example.com', 'password123');

    expect(result.success).toBe(true);
  });

  it('signUp: sends the profile as the metadata handle_new_user reads', async () => {
    const signUp = vi.fn().mockResolvedValue({ error: null });
    setup({ signUp });
    const profile = {
      accountType: 'customer',
      fullName: 'Ana',
      phone: null,
      acceptedTerms: true,
      acceptedPrivacy: true,
      confirmedAge: true,
      termsVersion: 'v1',
      privacyVersion: 'p1',
    } as const;
    await service.signUp('ana@example.com', 'password123', profile);

    expect(signUp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'password123',
      options: { data: SignUpMetadata.signUpMetadata(profile) },
    });
  });

  it('signUp: never reveals that an email is already registered', async () => {
    setup({
      signUp: vi.fn().mockResolvedValue({
        error: { message: 'User already registered' },
      }),
    });

    const result = await service.signUp('existing@example.com', 'password123');

    expect(result).toEqual({ success: true });
  });

  it('signUp: rejects weak passwords before calling Supabase', async () => {
    const signUp = vi.fn();
    setup({ signUp });

    expect(await service.signUp('a@example.com', 'abcdefgh')).toEqual({
      success: false,
      errorKey: 'auth.validation.passwordWeak',
    });
    expect(await service.signUp('a@example.com', 'abc123')).toEqual({
      success: false,
      errorKey: 'auth.validation.passwordWeak',
    });
    expect(signUp).not.toHaveBeenCalled();
  });

  // ── signOut ────────────────────────────────────────────────────────────────

  it('signOut: returns success and clears session', async () => {
    setup({
      signOut: vi.fn().mockResolvedValue({ error: null }),
    });

    const result = await service.signOut();

    expect(result.success).toBe(true);
    expect(supabaseStub.client.auth.signOut).toHaveBeenCalledOnce();
  });
});
