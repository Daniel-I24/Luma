import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthCodeService } from '@core/auth/auth-code.service';
import { CODE_LIFETIME_MS, MAX_CODE_ATTEMPTS, RESEND_WAIT_S, RecoveryFlow } from './recovery-flow';

const E = 'auth.forgotPassword.errors';

describe('RecoveryFlow', () => {
  const codes = { requestRecoveryCode: vi.fn(), verifyRecoveryCode: vi.fn(), setRecoveredPassword: vi.fn() };
  const wrong = { success: false, errorKey: 'auth.errors.codeInvalid' };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    codes.requestRecoveryCode.mockResolvedValue({ success: true });
    TestBed.configureTestingModule({ providers: [RecoveryFlow, { provide: AuthCodeService, useValue: codes }] });
  });
  afterEach(() => vi.useRealTimers());

  const sent = async (): Promise<RecoveryFlow> => {
    const flow = TestBed.inject(RecoveryFlow);
    flow.email.set('ana@example.com');
    await flow.sendCode();
    return flow;
  };

  it('a wrong code says so and stays on the code step', async () => {
    const flow = await sent();
    codes.verifyRecoveryCode.mockResolvedValue(wrong);
    expect(await flow.verify('111111')).toBe(false);
    expect(flow.errorKey()).toBe(`${E}.codeWrong`);
    expect(flow.step()).toBe('code');
  });

  it('after 10 minutes the same answer means the code expired', async () => {
    const flow = await sent();
    codes.verifyRecoveryCode.mockResolvedValue(wrong);
    vi.advanceTimersByTime(CODE_LIFETIME_MS + 1);
    await flow.verify('111111');
    expect(flow.errorKey()).toBe(`${E}.codeExpired`);
  });

  it('too many attempts (or Supabase rate limit) asks for a new code', async () => {
    const flow = await sent();
    codes.verifyRecoveryCode.mockResolvedValue(wrong);
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) await flow.verify('111111');
    expect(flow.errorKey()).toBe(`${E}.tooManyAttempts`);
    codes.verifyRecoveryCode.mockClear();
    await flow.verify('123456');
    expect(codes.verifyRecoveryCode).not.toHaveBeenCalled();

    codes.verifyRecoveryCode.mockResolvedValue({ success: false, errorKey: 'auth.errors.tooManyRequests' });
    vi.advanceTimersByTime(RESEND_WAIT_S * 1000);
    await flow.sendCode();
    await flow.verify('123456');
    expect(flow.errorKey()).toBe(`${E}.tooManyAttempts`);
  });

  it('"Reenviar código" waits 60 s; a right code moves on to the password', async () => {
    const flow = await sent();
    expect(flow.resendIn()).toBe(RESEND_WAIT_S);
    expect(await flow.sendCode()).toBe(false);
    vi.advanceTimersByTime(RESEND_WAIT_S * 1000);
    expect(flow.resendIn()).toBe(0);
    expect(await flow.sendCode()).toBe(true);
    expect(codes.requestRecoveryCode).toHaveBeenCalledTimes(2);

    codes.verifyRecoveryCode.mockResolvedValue({ success: true });
    expect(await flow.verify('123456')).toBe(true);
    expect(flow.step()).toBe('password');
  });
});
