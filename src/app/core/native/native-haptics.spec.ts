import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { NativeHaptics } from './native-haptics';

const impact = vi.fn();
const native = { value: false };

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value } }));
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: (options: unknown) => impact(options) },
  ImpactStyle: { Light: 'LIGHT' },
}));

describe('NativeHaptics', () => {
  it('uses the device haptics on Android', async () => {
    native.value = true;
    await TestBed.inject(NativeHaptics).tap();
    expect(impact).toHaveBeenCalledWith({ style: 'LIGHT' });
  });

  it('falls back to the Vibration API on the web, and never throws without it', async () => {
    native.value = false;
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    await TestBed.inject(NativeHaptics).tap();
    expect(vibrate).toHaveBeenCalledWith(10);

    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
    await expect(TestBed.inject(NativeHaptics).tap()).resolves.toBeUndefined();
  });
});
