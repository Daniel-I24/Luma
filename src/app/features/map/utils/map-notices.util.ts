import type { GeoState } from '../services/geolocation.service';

export interface MapNoticeInput {
  geoState: GeoState;
  loading: boolean;
  empty: boolean;
}

/**
 * Returns the i18n keys of the status notices shown over the map:
 * at most one about the user's location and one about the businesses.
 */
export function getMapNotices({ geoState, loading, empty }: MapNoticeInput): string[] {
  const notices: string[] = [];

  if (geoState === 'locating') notices.push('map.locating');
  else if (geoState === 'denied') notices.push('map.locationDenied');

  if (loading) notices.push('map.loadingBusinesses');
  else if (empty) notices.push('map.noBusinesses');

  return notices;
}
