import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { AuthCodeService } from './auth-code.service';
import { AuthCode } from './auth.schemas';

describe('AuthCodeService', () => {
  const auth = {
    verifyOtp: vi.fn(),
    resend: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
  };
  let service: AuthCodeService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: { auth } } }],
    });
    service = TestBed.inject(AuthCodeService);
  });

  it('confirms a sign-up with the 6-digit code (type signup)', async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });

    expect(await service.confirmSignup(' ana@example.com ', '123456')).toEqual({ success: true });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      token: '123456',
      type: 'signup',
    });
  });

  it('maps a wrong or expired code to one translated message', async () => {
    auth.verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });

    expect(await service.confirmSignup('ana@example.com', '000000')).toEqual({
      success: false,
      errorKey: 'auth.errors.codeInvalid',
    });
  });

  it('rejects malformed codes without calling Supabase', async () => {
    expect((await service.confirmSignup('ana@example.com', '12345')).errorKey).toBe(
      'auth.validation.codeInvalid',
    );
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('never reveals whether an email has an account when sending codes', async () => {
    auth.resend.mockResolvedValue({ error: { message: 'User not found' } });
    auth.resetPasswordForEmail.mockResolvedValue({ error: { message: 'User not found' } });

    expect(await service.resendSignupCode('nobody@example.com')).toEqual({ success: true });
    expect(await service.requestRecoveryCode('nobody@example.com')).toEqual({ success: true });
    expect(auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'nobody@example.com' });
  });

  it('still reports rate limits and network errors', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: { message: 'Too many requests' } });

    expect((await service.requestRecoveryCode('ana@example.com')).errorKey).toBe(
      'auth.errors.tooManyRequests',
    );
  });

  it('recovers a password in two calls: the code is checked before any password is sent', async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    auth.updateUser.mockResolvedValue({ error: null });

    expect(await service.verifyRecoveryCode('ana@example.com', '654321')).toEqual({ success: true });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'ana@example.com', token: '654321', type: 'recovery' });
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(await service.setRecoveredPassword('Nueva2026')).toEqual({ success: true });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'Nueva2026' });
  });

  it('reports a failed code, and refuses a password without its required parts', async () => {
    auth.verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });

    expect((await service.verifyRecoveryCode('ana@example.com', '654321')).errorKey).toBe('auth.errors.codeInvalid');
    // No uppercase letter: Supabase would refuse it too.
    expect((await service.setRecoveredPassword('nueva2026')).errorKey).toBe('auth.validation.passwordWeak');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('keeps only the digits of a pasted code', () => {
    expect(AuthCode.normalizeCode(' 123 456 ')).toBe('123456');
    expect(AuthCode.normalizeCode('12-34-56-78')).toBe('123456');
  });
});
