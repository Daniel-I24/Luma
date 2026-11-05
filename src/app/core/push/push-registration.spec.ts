import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { SIGN_OUT_HOOK_TIMEOUT_MS, SignOutHooks } from '@core/auth/session-end';
import { DeviceTokenRepository } from './device-token.repository';
import { PushPlatform } from './push-platform';
import type { PushAction } from './push-types';
import { PushRegistration } from './push-registration.service';

describe('PushRegistration', () => {
  const user = signal<{ id: string } | null>(null);
  let onAction: (action: PushAction) => void = () => undefined;
  const platform = {
    permission: vi.fn(),
    requestPermission: vi.fn(),
    register: vi.fn().mockResolvedValue('tok-1'),
    unregister: vi.fn().mockResolvedValue(undefined),
    onTokenRenewed: vi.fn(),
    createChannels: vi.fn().mockResolvedValue(undefined),
    onAction: vi.fn(async (listener: (action: PushAction) => void) => void (onAction = listener)),
  };
  const tokens = { register: vi.fn().mockResolvedValue(null), unregister: vi.fn().mockResolvedValue(null) };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    user.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user } },
        { provide: PushPlatform, useValue: platform },
        { provide: DeviceTokenRepository, useValue: tokens },
        { provide: TranslocoService, useValue: { translate: (key: string) => key } },
      ],
    });
  });

  const service = () => {
    const s = TestBed.inject(PushRegistration);
    TestBed.tick();
    return s;
  };

  it('never asks for permission by itself; refreshes a granted token on sign-in', async () => {
    platform.permission.mockResolvedValue('granted');
    const push = service();
    await push.init();
    user.set({ id: 'u1' });
    TestBed.tick();
    await vi.waitFor(() => expect(tokens.register).toHaveBeenCalledWith('tok-1'));
    expect(platform.requestPermission).not.toHaveBeenCalled();
    expect(platform.createChannels.mock.calls[0]?.[0].map((c: { id: string }) => c.id)).toEqual(['orders', 'promotions']);
  });

  it('enable() asks once from a user action and registers when granted', async () => {
    user.set({ id: 'u1' });
    platform.permission.mockResolvedValueOnce('prompt').mockResolvedValueOnce('prompt').mockResolvedValue('granted');
    platform.requestPermission.mockResolvedValue('granted');
    const push = service();
    expect(await push.enable()).toBe('granted');
    expect(push.permission()).toBe('granted');
    expect(tokens.register).toHaveBeenCalled();
  });

  it('removes the token before signing out, so a shared phone stops getting the old notices', async () => {
    platform.permission.mockResolvedValue('granted');
    service();
    user.set({ id: 'u1' });
    TestBed.tick();
    await vi.waitFor(() => expect(tokens.register).toHaveBeenCalled());
    await TestBed.inject(SignOutHooks).run();
    expect(tokens.unregister).toHaveBeenCalledWith('tok-1');
    expect(platform.unregister).toHaveBeenCalledTimes(1);
  });

  it('unlinks a token registered in an earlier run, even without permission to refresh it', async () => {
    localStorage.setItem('luma.push.token', 'tok-old');
    platform.permission.mockResolvedValue('denied');
    service();
    await TestBed.inject(SignOutHooks).run();
    expect(tokens.unregister).toHaveBeenCalledWith('tok-old');
    expect(platform.unregister).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('luma.push.token')).toBeNull();
  });

  it('starting the app without a session keeps the link; a session that ends stops FCM', async () => {
    localStorage.setItem('luma.push.token', 'tok-1');
    platform.permission.mockResolvedValue('granted');
    service();
    expect(platform.unregister).not.toHaveBeenCalled();
    user.set({ id: 'u1' });
    TestBed.tick();
    await vi.waitFor(() => expect(tokens.register).toHaveBeenCalled());
    user.set(null);
    TestBed.tick();
    await vi.waitFor(() => expect(platform.unregister).toHaveBeenCalledTimes(1));
  });

  it('a token renewed with the app open replaces the old one', async () => {
    platform.permission.mockResolvedValue('granted');
    service();
    user.set({ id: 'u1' });
    TestBed.tick();
    await vi.waitFor(() => expect(localStorage.getItem('luma.push.token')).toBe('tok-1'));
    (platform.onTokenRenewed.mock.calls[0]?.[0] as (token: string) => void)('tok-2');
    await vi.waitFor(() => expect(tokens.unregister).toHaveBeenCalledWith('tok-1'));
    expect(tokens.register).toHaveBeenLastCalledWith('tok-2');
    expect(localStorage.getItem('luma.push.token')).toBe('tok-2');
  });

  it('a tapped notice opens the screen PushRoute picks', async () => {
    platform.permission.mockResolvedValue('denied');
    const push = service();
    await push.init();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    onAction({ type: 'order_status', orderId: 'o1', businessId: 'b1' });
    onAction({ type: 'promotion', orderId: null, businessId: null });
    expect(navigate.mock.calls).toEqual([[['/orders', 'o1']], [['/notifications']]]);
  });
});

describe('SignOutHooks', () => {
  it('never waits longer than the timeout, whatever the hooks do', async () => {
    vi.useFakeTimers();
    const hooks = new SignOutHooks();
    hooks.add(() => new Promise(() => undefined));
    hooks.add(() => Promise.reject(new Error('offline')));
    const done = hooks.run();
    await vi.advanceTimersByTimeAsync(SIGN_OUT_HOOK_TIMEOUT_MS);
    await expect(done).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});
