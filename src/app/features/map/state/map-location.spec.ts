import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppEvents } from '@core/native/app-events';
import { SystemSettings } from '@core/native/system-settings';
import { type GeoState, GeolocationService, type LocationFailure } from '@shared/geo/geolocation.service';
import { MapCameraService } from '../services/map-camera.service';
import { MapLocation } from './map-location';

describe('MapLocation', () => {
  const state = signal<GeoState>('idle');
  const failure = signal<LocationFailure | null>(null);
  const resumes = signal(0);
  const geo = {
    state,
    failure,
    hasRealLocation: computed(() => state() === 'granted'),
    coords: signal({ lat: 1, lng: 2 }),
    requestLocation: vi.fn(),
    requestIfAllowed: vi.fn().mockResolvedValue(undefined),
  };
  const camera = { flyTo: vi.fn() };
  const settings = { available: true, openApp: vi.fn().mockResolvedValue(undefined), openLocation: vi.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    vi.clearAllMocks();
    state.set('idle');
    failure.set(null);
    resumes.set(0);
    TestBed.configureTestingModule({
      providers: [
        MapLocation,
        { provide: GeolocationService, useValue: geo },
        { provide: MapCameraService, useValue: camera },
        { provide: SystemSettings, useValue: settings },
        { provide: AppEvents, useValue: { resumes } },
      ],
    });
  });

  const flow = (): MapLocation => TestBed.inject(MapLocation);

  it('without a position the button explains first; "Permitir" reads', () => {
    const location = flow();
    location.centre();
    expect(location.promptOpen()).toBe(true);
    expect(geo.requestLocation).not.toHaveBeenCalled();
    location.allow();
    expect(location.promptOpen()).toBe(false);
    expect(geo.requestLocation).toHaveBeenCalledOnce();
  });

  it('with a position the button centres the map', () => {
    state.set('granted');
    flow().centre();
    expect(camera.flyTo).toHaveBeenCalledWith(1, 2);
  });

  it('does nothing while it is looking', () => {
    state.set('locating');
    const location = flow();
    location.centre();
    expect(location.promptOpen()).toBe(false);
  });

  it('after a failed attempt it opens again and says why', () => {
    const location = flow();
    location.allow();
    state.set('locating');
    TestBed.tick();
    state.set('unavailable');
    failure.set('servicesOff');
    TestBed.tick();
    expect(location.promptOpen()).toBe(true);
    expect(location.zoneKey()).toBe('map.locationOff');
  });

  it('closes by itself when the position arrives', () => {
    const location = flow();
    location.promptOpen.set(true);
    state.set('granted');
    TestBed.tick();
    expect(location.promptOpen()).toBe(false);
  });

  it('settings: the app for a refused permission, the location of the phone when it is off', async () => {
    const location = flow();
    failure.set('denied');
    expect(location.canOpenSettings()).toBe(true);
    await location.openSettings();
    expect(settings.openApp).toHaveBeenCalledOnce();
    failure.set('servicesOff');
    await location.openSettings();
    expect(settings.openLocation).toHaveBeenCalledOnce();
    failure.set('timeout');
    expect(location.canOpenSettings()).toBe(false);
  });

  it('coming back to the app after a failure tries again without asking', () => {
    flow();
    TestBed.tick();
    resumes.set(1);
    TestBed.tick();
    expect(geo.requestIfAllowed).not.toHaveBeenCalled();
    failure.set('denied');
    TestBed.tick();
    resumes.set(2);
    TestBed.tick();
    expect(geo.requestIfAllowed).toHaveBeenCalledOnce();
  });

  it('opening the map reads only what was already allowed', () => {
    flow().start();
    expect(geo.requestIfAllowed).toHaveBeenCalledOnce();
    expect(geo.requestLocation).not.toHaveBeenCalled();
  });
});
