import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorLog } from '@core/errors/error-log';
import { PushDiagnostics } from './push-diagnostics';
import { PERMISSION_READ_TIMEOUT_MS, PushPermissions } from './push-permissions';
import { PushPlatform } from './push-platform';

describe('PushPermissions', () => {
  const platform = { permission: vi.fn(), requestPermission: vi.fn() };
  const step = () => TestBed.inject(PushDiagnostics).steps()['permission'];
  const service = () => TestBed.inject(PushPermissions);

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: PushPlatform, useValue: platform }] });
  });

  afterEach(() => vi.useRealTimers());

  it('keeps each answer in the permission step', async () => {
    platform.permission.mockResolvedValue('prompt');
    await expect(service().read()).resolves.toEqual({ permission: 'prompt', failed: false });
    expect(step()).toMatchObject({ ok: false, detail: 'prompt' });

    platform.requestPermission.mockResolvedValue('granted');
    await expect(service().ask()).resolves.toEqual({ permission: 'granted', failed: false });
    expect(step()).toMatchObject({ ok: true, detail: 'granted' });
  });

  it('a plugin failure stays in the step with its message, masked, and in ErrorLog', async () => {
    const message = '"PushNotifications.checkPermissions()" is not implemented on android, ana@mail.com';
    platform.permission.mockRejectedValue(new Error(message));
    await expect(service().read()).resolves.toEqual({ permission: 'unavailable', failed: true });
    expect(step()).toMatchObject({
      ok: false,
      detail: '"PushNotifications.checkPermissions()" is not implemented on android, <email>',
    });
    expect(TestBed.inject(ErrorLog).entries()[0]).toMatchObject({ source: 'push' });
  });

  it('a failing dialog is not an answer: the permission is still to be asked', async () => {
    platform.requestPermission.mockRejectedValue(new Error('push_dialog_failed'));
    await expect(service().ask()).resolves.toEqual({ permission: 'prompt', failed: true });
    expect(step()).toMatchObject({ ok: false, detail: 'push_dialog_failed' });
  });

  it('the step shows where a call that never settles stopped', () => {
    platform.requestPermission.mockReturnValue(new Promise(() => undefined));
    void service().ask();
    expect(step()).toMatchObject({ ok: false, detail: 'asking' });
  });

  it('a read that never settles fails with its code once the time is up', async () => {
    vi.useFakeTimers();
    platform.permission.mockReturnValue(new Promise(() => undefined));
    const result = service().read();
    expect(step()).toMatchObject({ ok: false, detail: 'checking' });
    await vi.advanceTimersByTimeAsync(PERMISSION_READ_TIMEOUT_MS);
    await expect(result).resolves.toEqual({ permission: 'unavailable', failed: true });
    expect(step()).toMatchObject({ ok: false, detail: 'push_permission_timeout' });
  });
});
