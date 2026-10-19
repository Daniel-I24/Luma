import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NativeShell } from './native-shell';

const native = { value: true };
const listeners = new Map<string, (event: { canGoBack: boolean }) => void>();
const exitApp = vi.fn();

// Isolated spec files keep these plugin mocks local to this file.
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value } }));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (name: string, fn: (event: { canGoBack: boolean }) => void) => {
      listeners.set(name, fn);
      return Promise.resolve({ remove: vi.fn() });
    },
    exitApp: () => exitApp(),
  },
}));
vi.mock('@capacitor/keyboard', () => ({
  Keyboard: {
    addListener: (name: string, fn: () => void) => {
      listeners.set(name, fn as never);
      return Promise.resolve({ remove: vi.fn() });
    },
  },
}));

describe('NativeShell', () => {
  const location = { back: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    listeners.clear();
    native.value = true;
    TestBed.configureTestingModule({ providers: [{ provide: Location, useValue: location }] });
  });

  it('goes back in the app, and closes it on the first screen', async () => {
    await TestBed.inject(NativeShell).init();

    listeners.get('backButton')!({ canGoBack: true });
    expect(location.back).toHaveBeenCalledTimes(1);
    listeners.get('backButton')!({ canGoBack: false });
    expect(exitApp).toHaveBeenCalledTimes(1);
  });

  it('scrolls the focused field into view when the keyboard opens', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    input.scrollIntoView = vi.fn();
    await TestBed.inject(NativeShell).init();

    listeners.get('keyboardDidShow')!({ canGoBack: false });
    expect(input.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  });

  it('does nothing on the web', async () => {
    native.value = false;
    await TestBed.inject(NativeShell).init();
    expect(listeners.size).toBe(0);
  });
});
