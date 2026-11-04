import { SignUpMetadata } from './sign-up-profile';
import { describe, expect, it, vi } from 'vitest';
import { authServiceHarness } from './auth.service.harness';

describe('AuthService: sign-up and sign-out', () => {
  const h = authServiceHarness();
  const { setup } = h;

  it('signUp: returns success for a new valid user', async () => {
    setup({
      signUp: vi.fn().mockResolvedValue({ error: null }),
    });

    const result = await h.service.signUp('newuser@example.com', 'password123');

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
    await h.service.signUp('ana@example.com', 'password123', profile);

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

    const result = await h.service.signUp('existing@example.com', 'password123');

    expect(result).toEqual({ success: true });
  });

  it('signUp: rejects weak passwords before calling Supabase', async () => {
    const signUp = vi.fn();
    setup({ signUp });

    expect(await h.service.signUp('a@example.com', 'abcdefgh')).toEqual({
      success: false,
      errorKey: 'auth.validation.passwordWeak',
    });
    expect(await h.service.signUp('a@example.com', 'abc123')).toEqual({
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

    const result = await h.service.signOut();

    expect(result.success).toBe(true);
    expect(h.supabaseStub.client.auth.signOut).toHaveBeenCalledOnce();
  });
});
