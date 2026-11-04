import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectivityService } from '@core/network/connectivity.service';
import { SupabaseService } from '@core/supabase/supabase.service';
import { PasswordChangeService } from './password-change.service';

describe('PasswordChangeService', () => {
  const auth = {
    getUser: vi.fn(),
    signInWithPassword: vi.fn(),
    updateUser: vi.fn(),
    reauthenticate: vi.fn(),
  };
  let service: PasswordChangeService;

  beforeEach(() => {
    vi.clearAllMocks();
    auth.getUser.mockResolvedValue({ data: { user: { email: 'ana@example.com' } } });
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { client: { auth } } },
        { provide: ConnectivityService, useValue: { online: signal(true) } },
      ],
    });
    service = TestBed.inject(PasswordChangeService);
  });

  it('checks the current password and e-mails a code, then saves the new password with it as the nonce', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.reauthenticate.mockResolvedValue({ error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    expect((await service.requestCode('vieja-clave-1', 'Nueva-clave-2')).success).toBe(true);
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'vieja-clave-1' });
    expect(auth.reauthenticate).toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect((await service.confirm('Nueva-clave-2', ' 123456 ')).success).toBe(true);
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'Nueva-clave-2', nonce: '123456' });
  });

  it('a wrong current password never sends a code', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    expect(await service.requestCode('mala', 'Nueva-clave-2')).toEqual({ success: false, errorKey: 'account.password.wrongCurrent' });
    expect(auth.reauthenticate).not.toHaveBeenCalled();
  });

  it('weak or repeated passwords and malformed codes are refused before any request', async () => {
    expect((await service.requestCode('vieja-clave-1', 'corta')).errorKey).toBe('auth.validation.passwordWeak');
    expect((await service.requestCode('Misma-clave-1', 'Misma-clave-1')).errorKey).toBe('account.password.same');
    expect((await service.confirm('Nueva-clave-2', '12ab')).errorKey).toBe('auth.validation.codeInvalid');
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('wrong or expired codes and too many attempts get translated messages', async () => {
    auth.updateUser.mockResolvedValue({ error: { message: 'Reauthentication nonce is invalid' } });
    expect((await service.confirm('Nueva-clave-2', '000000')).errorKey).toBe('auth.errors.codeInvalid');
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.reauthenticate.mockResolvedValue({ error: { message: 'For security purposes, you can only request this after 42 seconds.' } });
    expect((await service.requestCode('vieja-clave-1', 'Nueva-clave-2')).errorKey).toBe('auth.errors.tooManyRequests');
  });
});
