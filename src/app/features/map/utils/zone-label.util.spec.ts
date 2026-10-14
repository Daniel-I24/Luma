import { describe, expect, it } from 'vitest';
import { getZoneLabelKey } from './zone-label.util';

describe('getZoneLabelKey', () => {
  it('shows the city centre until the user shares their location', () => {
    expect(getZoneLabelKey('idle')).toBe('map.zone.cityCentre');
    expect(getZoneLabelKey('unavailable')).toBe('map.zone.cityCentre');
  });

  it('tells the user while locating and when permission is denied', () => {
    expect(getZoneLabelKey('locating')).toBe('map.locating');
    expect(getZoneLabelKey('denied')).toBe('map.locationDenied');
  });

  it('shows that results are near the user once located', () => {
    expect(getZoneLabelKey('granted')).toBe('map.zone.nearYou');
  });
});
