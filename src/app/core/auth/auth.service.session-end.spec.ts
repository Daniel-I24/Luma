import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { AuthService } from './auth.service';
import { UserDataRegistry } from './user-data-registry';

describe('AuthService — ending the session', () => {
  let authListener: (event: string, session: unknown) => void;
  const auth = {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn(),
  };
  const functions = { invoke: vi.fn() };
  const router = { navigate: vi.fn() };
  const state = { clearUserData: vi.fn() };
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    auth.onAuthStateChange.mockImplementation((cb: typeof authListener) => (authListener = cb));
    auth.signOut.mockResolvedValue({ error: null });
    functions.invoke.mockResolvedValue({ data: { deleted: true }, error: null });
    router.navigate.mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client: { auth, functions } } },
        { provide: Router, useValue: router },
      ],
    });
    TestBed.inject(UserDataRegistry).register(state);
    service = TestBed.inject(AuthService);
  });

  it('deleteAccount: calls the function, ends the local session, wipes caches and goes to login', async () => {
    const result = await service.deleteAccount();

    expect(result).toEqual({ success: true });
    expect(functions.invoke).toHaveBeenCalledWith('delete-account', { method: 'POST' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(state.clearUserData).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
    expect(service.loading()).toBe(false);
  });

  it('deleteAccount: keeps the session and reports a translated error when the function fails', async () => {
    functions.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response('{}', { status: 500 })),
    });

    const result = await service.deleteAccount();

    expect(result).toEqual({ success: false, errorKey: 'auth.errors.deleteAccountFailed' });
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(state.clearUserData).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('deleteAccount: maps an expired session (401) to its own key', async () => {
    functions.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response('{}', { status: 401 })),
    });

    expect(await service.deleteAccount()).toEqual({
      success: false,
      errorKey: 'auth.errors.sessionExpired',
    });
  });

  it('deleteAccount: asks to sign in again when the last sign-in is too old (403)', async () => {
    functions.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(
        new Response('{"error":"reauth_required"}', { status: 403 }),
      ),
    });

    expect(await service.deleteAccount()).toEqual({
      success: false,
      errorKey: 'auth.errors.reauthRequired',
    });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('deleteAccount: maps a network failure to the network key', async () => {
    functions.invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError(new Error()) });

    expect((await service.deleteAccount()).errorKey).toBe('auth.errors.networkError');
  });

  it('deleteAccount: turns an unexpected exception into a generic error', async () => {
    functions.invoke.mockRejectedValue(new Error('boom'));

    expect(await service.deleteAccount()).toEqual({
      success: false,
      errorKey: 'auth.errors.unknown',
    });
    expect(service.loading()).toBe(false);
  });

  it('signOut: wipes per-user caches on success only', async () => {
    auth.signOut.mockResolvedValueOnce({ error: { message: 'network request failed' } });
    expect((await service.signOut()).success).toBe(false);
    expect(state.clearUserData).not.toHaveBeenCalled();

    expect((await service.signOut()).success).toBe(true);
    expect(state.clearUserData).toHaveBeenCalledOnce();
  });

  it('wipes per-user caches when the session ends elsewhere', () => {
    authListener('TOKEN_REFRESHED', null);
    expect(state.clearUserData).not.toHaveBeenCalled();

    authListener('SIGNED_OUT', null);
    expect(state.clearUserData).toHaveBeenCalledOnce();
  });
});
