import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocationError } from './location-source';
import { NativeLocationSource } from './native-location-source';
import { WebLocationSource } from './web-location-source';

const plugin = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
}));
vi.mock('@capacitor/geolocation', () => ({ Geolocation: plugin }));

const OPTIONS = { precise: false, timeoutMs: 8000, maxAgeMs: 1000 };
const POSITION = { coords: { latitude: 1, longitude: 2, accuracy: 33.4 } };

describe('NativeLocationSource', () => {
  const source = new NativeLocationSource();
  beforeEach(() => vi.resetAllMocks());

  it('asks for both precisions, so Android shows one dialog', async () => {
    plugin.requestPermissions.mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });
    expect(await source.request()).toBe('granted');
    expect(plugin.requestPermissions).toHaveBeenCalledWith({ permissions: ['location', 'coarseLocation'] });
  });

  it('tells precise, approximate, not asked and refused apart', async () => {
    const status = async (location: string, coarseLocation: string): Promise<string> => {
      plugin.checkPermissions.mockResolvedValue({ location, coarseLocation });
      return source.access();
    };
    expect(await status('granted', 'granted')).toBe('granted');
    expect(await status('denied', 'granted')).toBe('approximate');
    expect(await status('prompt', 'prompt')).toBe('prompt');
    expect(await status('prompt-with-rationale', 'prompt-with-rationale')).toBe('prompt');
    expect(await status('denied', 'denied')).toBe('denied');
  });

  it('with the system location off the plugin refuses to answer: that is a state', async () => {
    plugin.requestPermissions.mockRejectedValue({ code: 'OS-PLUG-GLOC-0007' });
    expect(await source.request()).toBe('servicesOff');
  });

  it('reads with the fallback for phones without Google services', async () => {
    plugin.getCurrentPosition.mockResolvedValue(POSITION);
    expect(await source.read(OPTIONS)).toEqual({ lat: 1, lng: 2, accuracyM: 33 });
    expect(plugin.getCurrentPosition).toHaveBeenCalledWith({ enableHighAccuracy: false, timeout: 8000, maximumAge: 1000, enableLocationFallback: true });
  });

  it.each([
    ['OS-PLUG-GLOC-0003', 'denied'],
    ['OS-PLUG-GLOC-0008', 'denied'],
    ['OS-PLUG-GLOC-0007', 'servicesOff'],
    ['OS-PLUG-GLOC-0009', 'servicesOff'],
    ['OS-PLUG-GLOC-0016', 'servicesOff'],
    ['OS-PLUG-GLOC-0017', 'servicesOff'],
    ['OS-PLUG-GLOC-0010', 'timeout'],
    ['OS-PLUG-GLOC-0002', 'unavailable'],
    ['OS-PLUG-GLOC-0015', 'unavailable'],
  ])('%s is %s', async (code, reason) => {
    plugin.getCurrentPosition.mockRejectedValue({ code });
    await expect(source.read(OPTIONS)).rejects.toEqual(new LocationError(reason as 'denied', code));
  });

  it('a watch stopped before it started is still cleared', async () => {
    plugin.watchPosition.mockResolvedValue('w1');
    plugin.clearWatch.mockResolvedValue(undefined);
    const stop = source.watch(() => undefined);
    stop();
    await vi.waitFor(() => expect(plugin.clearWatch).toHaveBeenCalledWith({ id: 'w1' }));
  });
});

describe('WebLocationSource', () => {
  const source = new WebLocationSource();
  const getCurrentPosition = vi.fn();

  beforeEach(() => {
    getCurrentPosition.mockReset();
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('passes the options to the browser', async () => {
    getCurrentPosition.mockImplementation((ok: (p: unknown) => void) => ok(POSITION));
    expect(await source.read({ precise: true, timeoutMs: 5, maxAgeMs: 6 })).toEqual({ lat: 1, lng: 2, accuracyM: 33 });
    expect(getCurrentPosition.mock.calls[0]![2]).toEqual({ enableHighAccuracy: true, timeout: 5, maximumAge: 6 });
  });

  it.each([
    [1, 'denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ])('browser error %i is %s', async (code, reason) => {
    getCurrentPosition.mockImplementation((_: unknown, bad: (e: unknown) => void) => bad({ code }));
    await expect(source.read(OPTIONS)).rejects.toEqual(new LocationError(reason as 'denied', `web-${code}`));
  });

  it('without the API, or without the Permissions API, it still answers', async () => {
    vi.stubGlobal('navigator', {});
    await expect(source.read(OPTIONS)).rejects.toBeInstanceOf(LocationError);
    expect(await source.access()).toBe('prompt');
    expect(source.watch(() => undefined)()).toBeUndefined();
  });

  it('reads the permission state where the browser has it', async () => {
    vi.stubGlobal('navigator', { permissions: { query: () => Promise.resolve({ state: 'granted' }) } });
    expect(await source.access()).toBe('granted');
    vi.stubGlobal('navigator', { permissions: { query: () => Promise.reject(new Error('no')) } });
    expect(await source.access()).toBe('prompt');
  });
});
