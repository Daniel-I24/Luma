import { METERS_PER_KM, MINUTES_PER_HOUR } from '@core/config/units';

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

