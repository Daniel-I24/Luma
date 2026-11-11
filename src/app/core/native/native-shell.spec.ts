import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackNavigation } from '@core/navigation/back-navigation';
import { NativeShell } from './native-device';

const native = { value: true };
const listeners = new Map<string, (event: { canGoBack: boolean }) => unknown>();
const minimizeApp = vi.fn();
const hide = vi.fn();

// Isolated spec files keep these plugin mocks local to this file.
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value, isPluginAvailable: () => true } }));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (name: string, fn: (event: { canGoBack: boolean }) => void) => {
      listeners.set(name, fn);
      return Promise.resolve({ remove: vi.fn() });
    },
    minimizeApp: () => minimizeApp(),
  },
}));
vi.mock('@capacitor/keyboard', () => ({
  Keyboard: {
    addListener: (name: string, fn: () => void) => {
      listeners.set(name, fn as never);
      return Promise.resolve({ remove: vi.fn() });
    },
    hide: () => hide(),
  },
}));

describe('NativeShell', () => {
  const back = { back: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    listeners.clear();
    native.value = true;
    TestBed.configureTestingModule({ providers: [{ provide: BackNavigation, useValue: back }] });
  });

  it('goes back as BackNavigation decides, and minimises the app at home', async () => {
    await TestBed.inject(NativeShell).init();

    back.back.mockResolvedValue('handled');
    await listeners.get('backButton')!({ canGoBack: true });
    expect(back.back).toHaveBeenCalledTimes(1);
    expect(minimizeApp).not.toHaveBeenCalled();
    back.back.mockResolvedValue('exit');
    await listeners.get('backButton')!({ canGoBack: false });
    expect(minimizeApp).toHaveBeenCalledTimes(1);
  });

  it('with the keyboard open, back only hides it', async () => {
    await TestBed.inject(NativeShell).init();
    (document.activeElement as HTMLElement).scrollIntoView = vi.fn();
    listeners.get('keyboardDidShow')!({ canGoBack: false });
    await listeners.get('backButton')!({ canGoBack: true });
    expect(hide).toHaveBeenCalledTimes(1);
    expect(back.back).not.toHaveBeenCalled();
    listeners.get('keyboardDidHide')!({ canGoBack: false });
    back.back.mockResolvedValue('handled');
    await listeners.get('backButton')!({ canGoBack: true });
    expect(back.back).toHaveBeenCalledTimes(1);
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
