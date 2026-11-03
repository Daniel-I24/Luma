import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { AuthService } from './auth.service';

type AuthStub = Record<string, ReturnType<typeof vi.fn>>;

function setup(auth: AuthStub): { service: AuthService; auth: AuthStub } {
  const stub: AuthStub = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...auth,
  };
  TestBed.configureTestingModule({
    providers: [AuthService, { provide: SupabaseService, useValue: { client: { auth: stub } } }],
  });
  return { service: TestBed.inject(AuthService), auth: stub };
}

const unconfirmed = { user: { id: 'u1', email_confirmed_at: null } };

describe('AuthService: only confirmed emails get a session', () => {
  it('signIn with an unconfirmed email fails and drops the local session', async () => {
    const { service, auth } = setup({
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: unconfirmed }, error: null }),
    });
    const result = await service.signIn('user@example.com', 'password123');
    expect(result).toEqual({ success: false, errorKey: 'auth.errors.emailNotConfirmed' });
    expect(auth['signOut']).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('a restored unconfirmed session counts as signed out', async () => {
    const { service } = setup({
      getSession: vi.fn().mockResolvedValue({ data: { session: unconfirmed }, error: null }),
    });
    await service.ready;
    expect(service.user()).toBeNull();
  });

  it('auth events with an unconfirmed session are ignored', async () => {
    let listener: (event: string, session: unknown) => void = () => undefined;
    const { service } = setup({
      onAuthStateChange: vi.fn((cb: typeof listener) => {
        listener = cb;
      }),
    });
    await service.ready;
    listener('SIGNED_IN', unconfirmed);
    expect(service.user()).toBeNull();
    listener('SIGNED_IN', { user: { id: 'u1', email_confirmed_at: '2026-10-01T00:00:00Z' } });
    expect(service.user()?.id).toBe('u1');
  });
});
