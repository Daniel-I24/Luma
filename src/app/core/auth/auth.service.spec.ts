import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { AuthService } from './auth.service';
import { SupabaseService } from '@core/supabase/supabase.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Creates a minimal SupabaseService stub with controllable auth responses. */
function makeSupabaseStub(overrides: Record<string, unknown> = {}) {
  return {
    client: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
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

// ── Test suite ────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let supabaseStub: ReturnType<typeof makeSupabaseStub>;

  function setup(authOverrides: Record<string, unknown> = {}) {
    supabaseStub = makeSupabaseStub(authOverrides);
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseService, useValue: supabaseStub },
      ],
    });
    service = TestBed.inject(AuthService);
  }

  // ── signIn ─────────────────────────────────────────────────────────────────

  it('signIn: returns success on valid credentials', async () => {
    setup({
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
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

  it('signUp: returns error key when email is already registered', async () => {
    setup({
      signUp: vi.fn().mockResolvedValue({
        error: { message: 'User already registered' },
      }),
    });

    const result = await service.signUp('existing@example.com', 'password123');

    expect(result.success).toBe(false);
    expect(result.errorKey).toBe('auth.errors.emailAlreadyRegistered');
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
