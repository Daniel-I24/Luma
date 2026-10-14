import type { GeoState } from '../services/geolocation.service';

/**
 * i18n key of the zone indicator over the map: where the shown businesses
 * are around, or what is happening with the user's location.
 */
export function getZoneLabelKey(geoState: GeoState): string {
  switch (geoState) {
    case 'locating':
      return 'map.locating';
    case 'denied':
      return 'map.locationDenied';
    case 'granted':
      return 'map.zone.nearYou';
    default:
      return 'map.zone.cityCentre';
  }
}
