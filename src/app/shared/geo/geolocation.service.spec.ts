import { beforeEach, describe, expect, it } from 'vitest';
import { LocationError, type LocationReading } from '@core/location/location-source';
import { access, near, read, request, service, settle, setUp, stop, watch } from './geolocation.service.harness';

describe('GeolocationService', () => {
  beforeEach(setUp);

  it('reads the position after the permission is granted, approximate first', async () => {
    read.mockResolvedValue(near(30));
    const geo = service();
    geo.requestLocation();
    expect(geo.state()).toBe('locating');
    await settle();
    expect(request).toHaveBeenCalledOnce();
    expect(read.mock.calls[0]![0]).toEqual(expect.objectContaining({ precise: false }));
    expect(geo.state()).toBe('granted');
    expect(geo.coords()).toEqual({ lat: 1.22, lng: -77.28 });
    expect(geo.lastAttempt()).toEqual(expect.objectContaining({ outcome: 'ok', source: 'native', access: 'granted', accuracyM: 30 }));
  });

  it('then looks for the precise one, and only keeps it when it is better', async () => {
    read.mockResolvedValueOnce(near(900)).mockResolvedValueOnce({ lat: 1.3, lng: -77.3, accuracyM: 12 });
    const geo = service();
    geo.requestLocation();
    await settle();
    expect(read.mock.calls[1]![0]).toEqual(expect.objectContaining({ precise: true, maxAgeMs: 0 }));
    expect(geo.coords()).toEqual({ lat: 1.3, lng: -77.3 });
    expect(geo.accuracy()).toBe(12);

    read.mockReset();
    read.mockResolvedValueOnce(near(900)).mockRejectedValueOnce(new LocationError('timeout'));
    geo.requestLocation();
    await settle();
    expect(geo.state()).toBe('granted');
    expect(geo.accuracy()).toBe(900);
  });

  it('indoors: when the approximate read times out, the GPS still answers', async () => {
    read.mockRejectedValueOnce(new LocationError('timeout')).mockResolvedValueOnce(near(20));
    const geo = service();
    geo.requestLocation();
    await settle();
    expect(read.mock.calls.map(([o]) => o.precise)).toEqual([false, true]);
    expect(geo.state()).toBe('granted');
  });

  it('a newer attempt wins over an older one that answers late', async () => {
    let late!: (reading: LocationReading) => void;
    read.mockImplementationOnce(() => new Promise((resolve) => (late = resolve))).mockResolvedValue(near(10));
    const geo = service();
    geo.requestLocation();
    await settle();
    geo.requestLocation();
    await settle();
    late({ lat: 9, lng: 9, accuracyM: 1 });
    await settle();
    expect(geo.coords()).toEqual({ lat: 1.22, lng: -77.28 });
  });

  it('requestIfAllowed reads without asking, and does nothing when it was not allowed', async () => {
    read.mockResolvedValue(near(30));
    const geo = service();
    await geo.requestIfAllowed();
    await settle();
    expect(read).not.toHaveBeenCalled();
    access.mockResolvedValue('granted');
    await geo.requestIfAllowed();
    await settle();
    expect(request).not.toHaveBeenCalled();
    expect(geo.state()).toBe('granted');
  });

  it('keeps the fallback centre until there is a real position', async () => {
    const geo = service();
    geo.useFallback({ lat: 4, lng: -74 });
    expect(geo.coords()).toEqual({ lat: 4, lng: -74 });
    read.mockResolvedValue(near(10));
    geo.requestLocation();
    await settle();
    geo.useFallback({ lat: 4, lng: -74 });
    expect(geo.coords()).toEqual({ lat: 1.22, lng: -77.28 });
  });

  it('one watch for every follower, stopped by the last one', () => {
    const geo = service();
    const a = geo.follow();
    const b = geo.follow();
    expect(watch).toHaveBeenCalledOnce();
    a();
    a();
    expect(stop).not.toHaveBeenCalled();
    b();
    expect(stop).toHaveBeenCalledOnce();
  });
});
