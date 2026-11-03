import { METERS_PER_KM, MINUTES_PER_HOUR, HALF } from '@core/config/units';
import { Pipe, PipeTransform } from '@angular/core';

/** Short distances are rounded to 10 m. */
const METERS_STEP = 10;
/** Average walking speed used to estimate travel time (estimate, not routing). */
const WALKING_SPEED_KMH = 5;

/** Distance — walking minutes and readable distances. */
export class Distance {
  /** Walking minutes for a straight-line distance; at least one minute. */
  public static walkingMinutes(km: number): number {
    return Math.max(1, Math.round((km / WALKING_SPEED_KMH) * MINUTES_PER_HOUR));
  }

  /** "450 m" under one kilometre (rounded to 10 m), otherwise "1,2 km" / "1.2 km". */
  public static formatDistance(km: number, lang: string): string {
    if (km < 1) return `${Math.max(METERS_STEP, Math.round((km * METERS_PER_KM) / METERS_STEP) * METERS_STEP)} m`;
    return `${km.toLocaleString(lang, { maximumFractionDigits: 1 })} km`;
  }
}

const SQUARE = 2;
/** Diameter in radii. */
const DIAMETER = 2;
const DEGREES_PER_PI = 180;
/** Haversine — great-circle distance between two WGS-84 points. */
export class Haversine {
  /** Haversine formula — distance in km between two WGS-84 points. */
  public static haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat * HALF) ** SQUARE +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng * HALF) ** SQUARE;
    return R * DIAMETER * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}


function toRad(deg: number): number {
  return (deg * Math.PI) / DEGREES_PER_PI;
}

/** Formats a distance in km for a language; null stays null (unknown). */
@Pipe({ name: 'distance', standalone: true })
export class DistancePipe implements PipeTransform {
  /** A readable distance ("350 m", "1,2 km"), or null when unknown. */
  public transform(km: number | null, lang: string): string | null {
    return km === null ? null : Distance.formatDistance(km, lang);
  }
}
