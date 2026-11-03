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

  it('checks the current password, then sets the new one', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    expect((await service.change('vieja-clave-1', 'nueva-clave-2')).success).toBe(true);
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'vieja-clave-1' });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'nueva-clave-2' });
  });

  it('a wrong current password never changes anything', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    expect(await service.change('mala', 'nueva-clave-2')).toEqual({ success: false, errorKey: 'account.password.wrongCurrent' });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('weak or repeated passwords are refused before any request', async () => {
    expect((await service.change('vieja-clave-1', 'corta')).errorKey).toBe('auth.validation.passwordWeak');
    expect((await service.change('misma-clave-1', 'misma-clave-1')).errorKey).toBe('account.password.same');
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
});
