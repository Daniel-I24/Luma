import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { failure, flow, geo, resumes, settings, setUp, state, zone } from './map-location.harness';

describe('MapLocation', () => {
  beforeEach(setUp);

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
    expect(zone.recentre).toHaveBeenCalledOnce();
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
    expect(location.zoneText().key).toBe('map.locationOff');
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
