import { describe, it, expect } from 'vitest';
import { getMapNotices } from './map-notices.util';

describe('getMapNotices', () => {
  it('returns no notices when idle with businesses loaded', () => {
    expect(getMapNotices({ geoState: 'idle', loading: false, empty: false })).toEqual([]);
  });

  it('shows the locating notice while the position is requested', () => {
    expect(getMapNotices({ geoState: 'locating', loading: false, empty: false })).toEqual([
      'map.locating',
    ]);
  });

  it('shows the denied notice when location permission is refused', () => {
    expect(getMapNotices({ geoState: 'denied', loading: false, empty: false })).toEqual([
      'map.locationDenied',
    ]);
  });

  it('shows the empty state when no businesses are nearby', () => {
    expect(getMapNotices({ geoState: 'granted', loading: false, empty: true })).toEqual([
      'map.noBusinesses',
    ]);
  });

  it('prefers the loading notice over the empty state', () => {
    expect(getMapNotices({ geoState: 'idle', loading: true, empty: true })).toEqual([
      'map.loadingBusinesses',
    ]);
  });

  it('combines a location notice with a businesses notice', () => {
    expect(getMapNotices({ geoState: 'denied', loading: false, empty: true })).toEqual([
      'map.locationDenied',
      'map.noBusinesses',
    ]);
  });
});
