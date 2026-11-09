import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type GeoCoords, type GeoState, GeolocationService } from '@shared/geo/geolocation.service';
import { PlaceSearchRepository } from '@shared/geo/place-search.repository';
import { MapCameraService } from '../services/map-camera.service';
import { MapZone } from './map-zone';

const HOME: GeoCoords = { lat: 3.4516, lng: -76.532 };
const north = (m: number): GeoCoords => ({ lat: HOME.lat + (m / 111) * 0.001, lng: HOME.lng });
const named = (neighbourhood: string | null, city: string | null = 'Cali') => ({ address: { street: null, houseNumber: null, neighbourhood, city }, errorKey: null });

describe('MapZone', () => {
  const state = signal<GeoState>('granted');
  const coords = signal<GeoCoords>(HOME);
  const centre = signal<GeoCoords | null>(null);
  const flyTo = vi.fn((lat: number, lng: number) => centre.set({ lat, lng }));
  const reverse = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    state.set('granted');
    coords.set(HOME);
    centre.set(null);
    reverse.mockResolvedValue(named('San Fernando'));
    TestBed.configureTestingModule({
      providers: [
        MapZone,
        { provide: GeolocationService, useValue: { coords, hasRealLocation: computed(() => state() === 'granted') } },
        { provide: MapCameraService, useValue: { centre, flyTo } },
        { provide: PlaceSearchRepository, useValue: { reverse } },
      ],
    });
  });

  const settle = async (): Promise<void> => {
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
  };

  const zoneAtHome = async (): Promise<MapZone> => {
    TestBed.inject(MapZone).follow(HOME);
    await settle();
    return TestBed.inject(MapZone);
  };

  it('names the neighbourhood of the user, from a rounded point', async () => {
    const zone = await zoneAtHome();
    expect(reverse).toHaveBeenCalledWith({ lat: 3.452, lng: -76.532 });
    expect(zone.label()).toEqual({ key: 'map.zone.at', params: { name: 'San Fernando' } });
  });

  it('falls back to the city', async () => {
    reverse.mockResolvedValue(named(null));
    expect((await zoneAtHome()).label().params).toEqual({ name: 'Cali' });
  });

  it('with no answer, or a failure, says "Cerca de ti"', async () => {
    reverse.mockResolvedValue({ address: null, errorKey: 'map.places.quota' });
    expect((await zoneAtHome()).label()).toEqual({ key: 'map.zone.nearYou', params: {} });
  });

  it('asks nothing while there is no real position', async () => {
    state.set('idle');
    TestBed.inject(MapZone);
    await settle();
    expect(reverse).not.toHaveBeenCalled();
  });

  it('GPS jitter under 200 m moves nothing and asks nothing', async () => {
    const zone = await zoneAtHome();
    flyTo.mockClear();
    reverse.mockClear();
    coords.set(north(150));
    zone.follow(north(150));
    await settle();
    expect(flyTo).not.toHaveBeenCalled();
    expect(reverse).not.toHaveBeenCalled();
  });

  it('from 200 m the map follows and the name is read again', async () => {
    const zone = await zoneAtHome();
    reverse.mockClear();
    reverse.mockResolvedValue(named('Granada'));
    coords.set(north(260));
    zone.follow(north(260));
    await settle();
    expect(flyTo).toHaveBeenLastCalledWith(north(260).lat, north(260).lng);
    expect(reverse).toHaveBeenCalledOnce();
    expect(zone.label().params).toEqual({ name: 'Granada' });
  });

  it('a place asked before is not asked again', async () => {
    const zone = await zoneAtHome();
    coords.set(north(500));
    zone.follow(north(500));
    await settle();
    reverse.mockClear();
    coords.set(HOME);
    zone.follow(HOME);
    await settle();
    expect(reverse).not.toHaveBeenCalled();
    expect(zone.label().params).toEqual({ name: 'San Fernando' });
  });

  it('when the user moves the map, it names the centre and stops following', async () => {
    const zone = await zoneAtHome();
    reverse.mockResolvedValue(named('Centro'));
    flyTo.mockClear();
    centre.set({ lat: 3.5, lng: -76.5 });
    await settle();
    expect(zone.browsing()).toBe(true);
    expect(zone.label()).toEqual({ key: 'map.zone.viewing', params: { name: 'Centro' } });
    coords.set(north(600));
    zone.follow(north(600));
    expect(flyTo).not.toHaveBeenCalled();
  });

  it('a small pan is still the user\'s place', async () => {
    const zone = await zoneAtHome();
    centre.set(north(100));
    await settle();
    expect(zone.browsing()).toBe(false);
  });

  it('going back centres on the user and follows again', async () => {
    const zone = await zoneAtHome();
    centre.set({ lat: 3.5, lng: -76.5 });
    await settle();
    zone.recentre();
    await settle();
    expect(zone.browsing()).toBe(false);
    expect(flyTo).toHaveBeenLastCalledWith(HOME.lat, HOME.lng);
  });

  it('a late answer about an old place does not replace the new one', async () => {
    let late!: (value: unknown) => void;
    reverse.mockImplementationOnce(() => new Promise((resolve) => (late = resolve))).mockResolvedValue(named('Nuevo'));
    const zone = TestBed.inject(MapZone);
    zone.follow(HOME);
    await settle();
    coords.set(north(500));
    zone.follow(north(500));
    await settle();
    late(named('Viejo'));
    await settle();
    expect(zone.label().params).toEqual({ name: 'Nuevo' });
  });
});
