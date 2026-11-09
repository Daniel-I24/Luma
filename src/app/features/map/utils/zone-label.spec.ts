import { describe, expect, it } from 'vitest';
import { ZoneLabel } from './zone-label';

describe('getZoneLabelKey', () => {
  it('shows the city centre until the user shares their location', () => {
    expect(ZoneLabel.getZoneLabelKey('idle')).toBe('map.zone.cityCentre');
    expect(ZoneLabel.getZoneLabelKey('unavailable')).toBe('map.zone.cityCentre');
  });

  it('tells the user while locating and when permission is denied', () => {
    expect(ZoneLabel.getZoneLabelKey('locating')).toBe('map.locating');
    expect(ZoneLabel.getZoneLabelKey('denied')).toBe('map.locationDenied');
  });

  it('says why there is no position when the reading failed', () => {
    expect(ZoneLabel.getZoneLabelKey('unavailable', 'servicesOff')).toBe('map.locationOff');
    expect(ZoneLabel.getZoneLabelKey('unavailable', 'timeout')).toBe('map.locationNoSignal');
    expect(ZoneLabel.getZoneLabelKey('unavailable', 'unavailable')).toBe('map.locationNoSignal');
    expect(ZoneLabel.getZoneLabelKey('denied', 'denied')).toBe('map.locationDenied');
  });

  it('shows that results are near the user once located', () => {
    expect(ZoneLabel.getZoneLabelKey('granted')).toBe('map.zone.nearYou');
  });
});
