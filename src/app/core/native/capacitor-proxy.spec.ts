import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectivityService } from '@core/network/connectivity.service';
import { PushPlatform } from '@core/push/push-platform';
import { PUSH_ENABLED } from '@core/push/push-types';
import { AppEvents } from './app-events';
import { ExternalBrowser, NativeHaptics } from './native-actions';
import { NativeShell, NativeStatusBar } from './native-device';

/**
 * A plugin behaves like Capacitor's proxy: any property, `then` included, is a
 * function; an unknown one rejects with "not implemented" and never calls the
 * callbacks it gets. So a proxy returned from a promise leaves that promise
 * pending for ever, and no try/catch around it runs: the failure of the phone.
 */
const { plugin, thenReads } = vi.hoisted(() => {
  const thenReads: string[] = [];
  const plugin = (name: string, methods: Record<string, unknown> = {}): object =>
    new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === '$$typeof') return undefined;
          if (prop === 'then') thenReads.push(name);
          if (typeof prop === 'string' && prop in methods) return methods[prop];
          return () => Promise.reject(new Error(`"${name}.${String(prop)}()" is not implemented on android`));
        },
      },
    );
  return { plugin, thenReads };
});

const listens = vi.hoisted(() => ({ addListener: () => Promise.resolve({ remove: () => Promise.resolve() }) }));

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'android', isNativePlatform: () => true, isPluginAvailable: () => true } }));
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: plugin('PushNotifications', {
    ...listens,
    checkPermissions: () => Promise.resolve({ receive: 'prompt' }),
    requestPermissions: () => Promise.resolve({ receive: 'granted' }),
    createChannel: () => Promise.resolve(),
    unregister: () => Promise.resolve(),
  }),
}));
vi.mock('@capacitor/app', () => ({
  App: plugin('App', { ...listens, getLaunchUrl: () => Promise.resolve(undefined) }),
}));
vi.mock('@capacitor/keyboard', () => ({ Keyboard: plugin('Keyboard', listens) }));
vi.mock('@capacitor/browser', () => ({ Browser: plugin('Browser', { open: () => Promise.resolve() }) }));
vi.mock('@capacitor/haptics', () => ({
  Haptics: plugin('Haptics', { impact: () => Promise.resolve() }),
  ImpactStyle: { Light: 'LIGHT' },
}));
vi.mock('@capacitor/network', () => ({
  Network: plugin('Network', { ...listens, getStatus: () => Promise.resolve({ connected: true }) }),
}));
vi.mock('@capacitor/status-bar', () => ({
  StatusBar: plugin('StatusBar', { setOverlaysWebView: () => Promise.resolve(), setStyle: () => Promise.resolve() }),
  Style: { Dark: 'DARK', Light: 'LIGHT' },
}));

/** A promise left pending for ever fails here, instead of hanging the test. */
const settled = <T>(work: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  const hung = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('never settled')), 500);
  });
  return Promise.race([work, hung]).finally(() => clearTimeout(timer));
};

describe('a Capacitor plugin proxy is never the value of a promise', () => {
  beforeEach(() => {
    thenReads.length = 0;
    TestBed.configureTestingModule({ providers: [{ provide: PUSH_ENABLED, useValue: true }] });
  });

  afterEach(() => expect(thenReads).toEqual([]));

  it('PushPlatform: every call settles', async () => {
    const push = TestBed.inject(PushPlatform);
    await expect(settled(push.permission())).resolves.toBe('prompt');
    await expect(settled(push.requestPermission())).resolves.toBe('granted');
    await expect(settled(push.createChannels([]))).resolves.toBeUndefined();
    await expect(settled(push.onAction(() => undefined))).resolves.toBeUndefined();
    await expect(settled(push.unregister())).resolves.toBeUndefined();
  });

  it('App, Keyboard, Browser, Haptics, Network and StatusBar: every call settles', async () => {
    await settled(TestBed.inject(NativeShell).init());
    await settled(TestBed.inject(AppEvents).init());
    await settled(TestBed.inject(ExternalBrowser).open('https://example.test'));
    await settled(TestBed.inject(NativeHaptics).tap());
    await settled(TestBed.inject(ConnectivityService).watchNative());
    await settled(TestBed.inject(NativeStatusBar).overlayWebView());
    await settled(TestBed.inject(NativeStatusBar).setContent('dark-content'));
  });
});
