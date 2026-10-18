/** The business day follows Colombia, like create_order (America/Bogota). */
export const BUSINESS_TIME_ZONE = 'America/Bogota';

/** "YYYY-MM-DD" of an instant in Bogota. */
export function bogotaDay(instant: Date): string {
  return instant.toLocaleDateString('en-CA', { timeZone: BUSINESS_TIME_ZONE });
}
