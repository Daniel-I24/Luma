import type { GeoCoords } from '@shared/geo/geolocation.service';
import { Haversine } from '@shared/geo/distance';
import type { Place } from '@shared/geo/place-search.repository';

/** A business is expected within this distance of its municipality's centre. */
export const MUNICIPALITY_RADIUS_KM = 15;
/** Two businesses closer than this share the same point. */
const SAME_POINT_KM = 0.015;
const MAX_CANDIDATES = 5;

/** A point the owner should look at twice before confirming. */
export type LocationWarning = 'farFromMunicipality' | 'sameAsOtherBusiness';

/** A search candidate with its distance to the municipality centre. */
export interface Candidate extends Place {
  readonly km: number;
}

const km = (a: GeoCoords, b: GeoCoords): number => Haversine.haversineKm(a.lat, a.lng, b.lat, b.lng);

/**
 * LocationChecks — pure rules of the LocationPicker (docs/location.md):
 * candidates outside the municipality are dropped, and a confirmed point
 * far from its centre or on top of another business of the owner is
 * flagged (a warning, never a block).
 */
export class LocationChecks {
  /** Candidates within the municipality radius, nearest first, at most 5. */
  public static candidates(places: readonly Place[], centre: GeoCoords | null): Candidate[] {
    const withKm = places.map((place) => ({ ...place, km: centre ? km(centre, place) : 0 }));
    return withKm.filter((c) => c.km <= MUNICIPALITY_RADIUS_KM).sort((a, b) => a.km - b.km).slice(0, MAX_CANDIDATES);
  }

  /** The warnings of a point. */
  public static warnings(point: GeoCoords, centre: GeoCoords | null, others: readonly GeoCoords[]): LocationWarning[] {
    const warnings: LocationWarning[] = [];
    if (centre && km(centre, point) > MUNICIPALITY_RADIUS_KM) warnings.push('farFromMunicipality');
    if (others.some((other) => km(other, point) < SAME_POINT_KM)) warnings.push('sameAsOtherBusiness');
    return warnings;
  }
}
