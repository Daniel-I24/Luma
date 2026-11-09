import { beforeEach, describe, expect, it } from 'vitest';
import { LocationError } from '@core/location/location-source';
import { PASTO_CENTRE } from './geolocation.service';
import { near, read, request, service, settle, setUp } from './geolocation.service.harness';

describe('GeolocationService when the position does not come', () => {
  beforeEach(setUp);

  it('a timeout is not a denied permission', async () => {
    read.mockRejectedValue(new LocationError('timeout', 'OS-PLUG-GLOC-0010'));
    const geo = service();
    geo.requestLocation();
    await settle();
    expect(geo.state()).toBe('unavailable');
    expect(geo.failure()).toBe('timeout');
    expect(geo.lastAttempt()).toEqual(expect.objectContaining({ outcome: 'timeout', code: 'OS-PLUG-GLOC-0010' }));
    expect(geo.coords()).toEqual(PASTO_CENTRE);
  });

  it('a refused permission does not read at all', async () => {
    request.mockResolvedValue('denied');
    const geo = service();
    geo.requestLocation();
    await settle();
    expect(read).not.toHaveBeenCalled();
    expect(geo.state()).toBe('denied');
    expect(geo.failure()).toBe('denied');
  });

  it('with the location of the system off, reads by GPS (the system dialog) and stops if it stays off', async () => {
    request.mockResolvedValue('servicesOff');
    read.mockRejectedValue(new LocationError('servicesOff', 'OS-PLUG-GLOC-0009'));
    const geo = service();
    geo.requestLocation();
    await settle();
    expect(read).toHaveBeenCalledOnce();
    expect(read.mock.calls[0]![0].precise).toBe(true);
    expect(geo.failure()).toBe('servicesOff');
  });

  it('with approximate only ("aproximada"), never asks for the GPS', async () => {
    request.mockResolvedValue('approximate');
    read.mockResolvedValue(near(2000));
    const geo = service();
    geo.requestLocation();
    await settle();
    expect(read).toHaveBeenCalledOnce();
    expect(read.mock.calls[0]![0].precise).toBe(false);
    expect(geo.state()).toBe('granted');
    expect(geo.lastAttempt()?.access).toBe('approximate');
  });

  it('with approximate only, a timeout waits longer and still never asks for the GPS', async () => {
    request.mockResolvedValue('approximate');
    read.mockRejectedValueOnce(new LocationError('timeout')).mockResolvedValueOnce(near(2000));
    const geo = service();
    geo.requestLocation();
    await settle();
    expect(read.mock.calls.map(([o]) => o.precise)).toEqual([false, false]);
    expect(read.mock.calls[1]![0].timeoutMs).toBeGreaterThan(read.mock.calls[0]![0].timeoutMs);
    expect(geo.state()).toBe('granted');
  });

  it('"Estoy en el local" wants a fresh GPS fix only', async () => {
    read.mockRejectedValue(new LocationError('timeout'));
    const geo = service();
    geo.requestLocation(true);
    await settle();
    expect(read).toHaveBeenCalledOnce();
    expect(read.mock.calls[0]![0]).toEqual(expect.objectContaining({ precise: true, maxAgeMs: 0 }));
  });
});
