/** Average walking speed used to estimate travel time (estimate, not routing). */
export const WALKING_SPEED_KMH = 5;

/** Walking minutes for a straight-line distance; at least one minute. */
export function walkingMinutes(km: number): number {
  return Math.max(1, Math.round((km / WALKING_SPEED_KMH) * 60));
}

/** "450 m" under one kilometre (rounded to 10 m), otherwise "1,2 km" / "1.2 km". */
export function formatDistance(km: number, lang: string): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km.toLocaleString(lang, { maximumFractionDigits: 1 })} km`;
}
