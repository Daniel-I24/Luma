import type { GeoState, LocationFailure } from '@shared/geo/geolocation.service';

/** What the label over the map says: a translation key and its values. */
export interface ZoneText {
  readonly key: string;
  readonly params: Readonly<Record<string, string>>;
}

/** ZoneLabel — the name of the zone the map shows. */
export class ZoneLabel {
  /**
   * i18n key of the zone indicator over the map: where the shown businesses
   * are around, or what is happening with the user's location.
   */
  public static getZoneLabelKey(geoState: GeoState, failure: LocationFailure | null = null): string {
    if (failure === 'servicesOff') return 'map.locationOff';
    if (failure === 'timeout' || failure === 'unavailable') return 'map.locationNoSignal';
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
}

