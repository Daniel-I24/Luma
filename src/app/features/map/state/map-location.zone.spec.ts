import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PASTO_CENTRE } from '@shared/geo/geolocation.service';
import { camera, flow, geo, setUp, state, stopFollowing } from './map-location.harness';

describe('MapLocation: zone, following and coverage', () => {
  beforeEach(setUp);

  it('says the real zone with a position, and only without one the centre of a town', () => {
    const location = flow();
    expect(location.zoneText()).toEqual({ key: 'map.zone.cityCentre', params: {} });
    geo.fallbackName.set('Cali');
    expect(location.zoneText()).toEqual({ key: 'map.zone.centreOf', params: { name: 'Cali' } });
    state.set('granted');
    expect(location.zoneText()).toEqual({ key: 'map.zone.at', params: { name: 'Granada' } });
    geo.fallbackName.set(null);
  });

  it('follows the position only while it has one and the screen is visible', () => {
    flow();
    TestBed.tick();
    expect(geo.follow).not.toHaveBeenCalled();
    state.set('granted');
    TestBed.tick();
    expect(geo.follow).toHaveBeenCalledOnce();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    TestBed.tick();
    expect(stopFollowing).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });

  it('is outside coverage far from Pasto; "Explorar Pasto" flies there', () => {
    const location = flow();
    camera.centre.set({ lat: 3.45, lng: -76.53 });
    expect(location.outsideCoverage()).toBe(true);
    location.explorePasto();
    expect(camera.flyTo).toHaveBeenCalledWith(PASTO_CENTRE.lat, PASTO_CENTRE.lng);
    camera.centre.set({ lat: PASTO_CENTRE.lat, lng: PASTO_CENTRE.lng });
    expect(location.outsideCoverage()).toBe(false);
    camera.centre.set(null);
  });
});
