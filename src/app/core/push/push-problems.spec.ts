import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { ErrorLog } from '@core/errors/error-log';
import { DeviceTokenRepository } from './device-token.repository';
import { PushDiagnostics } from './push-diagnostics';
import { PushPlatform } from './push-platform';
import { PushRegistration } from './push-registration.service';

/** "Permitir notificaciones" never throws: each failure is its own PushProblem. */
describe('PushRegistration problems', () => {
  const platform = {
    permission: vi.fn(),
    requestPermission: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
    createChannels: vi.fn(),
    onAction: vi.fn(),
    onTokenRenewed: vi.fn(),
  };
  const tokens = { register: vi.fn(), unregister: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    platform.createChannels.mockResolvedValue(undefined);
    platform.register.mockResolvedValue('tok-1');
    tokens.register.mockResolvedValue(null);
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user: signal({ id: 'u1' }) } },
        { provide: PushPlatform, useValue: platform },
        { provide: DeviceTokenRepository, useValue: tokens },
        { provide: TranslocoService, useValue: { translate: (key: string) => key } },
      ],
    });
  });

  const enable = async (): Promise<{ push: PushRegistration; log: ErrorLog }> => {
    const push = TestBed.inject(PushRegistration);
    await push.enable();
    return { push, log: TestBed.inject(ErrorLog) };
  };

  it('a denied permission (or a failing dialog) is "denied", not an error', async () => {
    platform.permission.mockResolvedValue('prompt');
    platform.requestPermission.mockRejectedValue(new Error('dialog failed'));
    const { push, log } = await enable();
    expect(push.permission()).toBe('denied');
    expect(push.problem()).toBe('denied');
    expect(log.entries()[0]).toMatchObject({ source: 'push', message: 'dialog failed' });
  });

  it('a phone built without Firebase says so', async () => {
    platform.permission.mockResolvedValue('not_configured');
    const { push } = await enable();
    expect(push.problem()).toBe('not_configured');
    expect(platform.register).not.toHaveBeenCalled();
  });

  it('a failed FCM registration and a failed token save have their own problems', async () => {
    platform.permission.mockResolvedValue('granted');
    platform.register.mockRejectedValueOnce(new Error('push_registration_failed'));
    const { push } = await enable();
    expect(push.problem()).toBe('registration_failed');

    tokens.register.mockResolvedValueOnce('email_not_confirmed');
    await push.enable();
    expect(push.problem()).toBe('token_save_failed');
    // The reason of the failed RPC is kept, for support.
    expect(TestBed.inject(PushDiagnostics).steps()['rpc']).toMatchObject({ ok: false, detail: 'email_not_confirmed' });
    expect(TestBed.inject(ErrorLog).entries()[0]?.message).toContain('email_not_confirmed');

    await push.enable();
    expect(push.problem()).toBeNull();
  });

  it('an FCM timeout is a registration problem with its code, not a global error', async () => {
    platform.permission.mockResolvedValue('granted');
    platform.register.mockRejectedValueOnce(new Error('push_registration_timeout'));
    const { push, log } = await enable();
    expect(push.problem()).toBe('registration_failed');
    expect(log.entries()[0]).toMatchObject({ source: 'push', message: 'push_registration_timeout' });
    expect(tokens.register).not.toHaveBeenCalled();
  });

  it('a plugin that throws while reading the permission leaves push unavailable', async () => {
    platform.permission.mockRejectedValue(new Error('plugin not implemented'));
    const push = TestBed.inject(PushRegistration);
    await expect(push.init()).resolves.toBeUndefined();
    await expect(push.enable()).resolves.toBe('unavailable');
    expect(TestBed.inject(ErrorLog).entries().length).toBeGreaterThan(0);
  });
});
