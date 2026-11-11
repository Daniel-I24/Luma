import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PushDiagnostics } from './push-diagnostics';
import { PushPlatform } from './push-platform';
import { type LoadedPush, PUSH_ENABLED, type PushPlugin } from './push-types';

type Handler = (payload: unknown) => void;

/** The plugin double: listeners by event, each with its own removable handle. */
class FakePlugin {
  public readonly handlers = new Map<string, Handler>();
  public readonly removed: string[] = [];
  public listenersReady: Promise<void> = Promise.resolve();
  public readonly register = vi.fn().mockResolvedValue(undefined);
  public readonly unregister = vi.fn().mockResolvedValue(undefined);
  public readonly removeAllListeners = vi.fn();
  public readonly createChannel = vi.fn().mockResolvedValue(undefined);
  public readonly requestPermissions = vi.fn().mockResolvedValue({ receive: 'denied' });

  public async addListener(event: string, handler: Handler) {
    await this.listenersReady;
    this.handlers.set(event, handler);
    return { remove: async () => void this.removed.push(event) };
  }
}

@Injectable()
class TestPlatform extends PushPlatform {
  public fake = new FakePlugin();
  public isAndroid = true;
  protected override async plugin(): Promise<LoadedPush> {
    return { push: this.fake as unknown as PushPlugin };
  }
  protected override android(): Promise<boolean> {
    return Promise.resolve(this.isAndroid);
  }
}

describe('PushPlatform', () => {
  let platform: TestPlatform;
  let plugin: FakePlugin;
  const emit = (event: string, payload: unknown) => plugin.handlers.get(event)?.(payload);
  const settle = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TestPlatform, { provide: PUSH_ENABLED, useValue: true }],
    });
    platform = TestBed.inject(TestPlatform);
    plugin = platform.fake;
  });

  afterEach(() => vi.useRealTimers());

  it('calls register() only once both listeners are in place', async () => {
    let ready: () => void = () => undefined;
    plugin.listenersReady = new Promise((resolve) => (ready = resolve));
    const token = platform.register();
    await settle();
    expect(plugin.register).not.toHaveBeenCalled();

    ready();
    await vi.waitFor(() => expect(plugin.register).toHaveBeenCalledTimes(1));
    emit('registration', { value: 'tok-123456789' });
    await expect(token).resolves.toBe('tok-123456789');
    expect(TestBed.inject(PushDiagnostics).steps()['event']?.detail).toBe('…456789 (13)');
  });

  it('a register() that throws rejects once and leaves no timer behind to reject later', async () => {
    vi.useFakeTimers();
    plugin.register.mockRejectedValue(new Error('SERVICE_NOT_AVAILABLE'));
    await expect(platform.register()).rejects.toThrow('SERVICE_NOT_AVAILABLE');
    expect(vi.getTimerCount()).toBe(0);
    expect(TestBed.inject(PushDiagnostics).steps()['error']).toMatchObject({ ok: false, detail: 'SERVICE_NOT_AVAILABLE' });
  });

  it('without an answer from FCM it fails by timeout', async () => {
    vi.useFakeTimers();
    const token = platform.register();
    const outcome = expect(token).rejects.toThrow('push_registration_timeout');
    await vi.advanceTimersByTimeAsync(20_000);
    await outcome;
    expect(TestBed.inject(PushDiagnostics).steps()['error']?.detail).toBe('push_registration_timeout');
  });

  it('a registrationError keeps the native code', async () => {
    const token = platform.register();
    const outcome = expect(token).rejects.toThrow('FIS_AUTH_ERROR');
    await vi.waitFor(() => expect(plugin.register).toHaveBeenCalled());
    emit('registrationError', { error: 'java.io.IOException: FIS_AUTH_ERROR' });
    await outcome;
  });

  it('after register() a renewed token and a tap still arrive; no listener is removed', async () => {
    const renewed = vi.fn();
    const tapped = vi.fn();
    platform.onTokenRenewed(renewed);
    await platform.onAction(tapped);
    const token = platform.register();
    await vi.waitFor(() => expect(plugin.register).toHaveBeenCalled());
    emit('registration', { value: 'tok-1' });
    await token;
    expect(renewed).not.toHaveBeenCalled();

    emit('registration', { value: 'tok-2' });
    emit('pushNotificationActionPerformed', { notification: { data: { type: 'promotion', order_id: 'o1' } } });

    expect(renewed).toHaveBeenCalledWith('tok-2');
    expect(tapped).toHaveBeenCalledWith({ type: 'promotion', orderId: 'o1', businessId: null, status: null });
    expect(plugin.removeAllListeners).not.toHaveBeenCalled();
    expect(plugin.removed).toEqual([]);
  });

  it('unregister() removes only its own listeners and keeps the tap', async () => {
    await platform.onAction(vi.fn());
    const token = platform.register();
    await vi.waitFor(() => expect(plugin.register).toHaveBeenCalled());
    emit('registration', { value: 'tok-1' });
    await token;

    await platform.unregister();

    expect(plugin.removed.sort()).toEqual(['registration', 'registrationError']);
    expect(plugin.unregister).toHaveBeenCalledTimes(1);
    expect(plugin.removeAllListeners).not.toHaveBeenCalled();
  });

  it('a plugin without permission answers "denied"', async () => {
    await expect(platform.requestPermission()).resolves.toBe('denied');
  });

  it('creates no channels on iPhone, where the plugin rejects the call', async () => {
    const channels = [{ id: 'orders', name: 'Pedidos', description: 'x', importance: 4 }] as const;
    platform.isAndroid = false;
    await platform.createChannels(channels);
    expect(plugin.createChannel).not.toHaveBeenCalled();
    platform.isAndroid = true;
    await platform.createChannels(channels);
    expect(plugin.createChannel).toHaveBeenCalledOnce();
  });
});
