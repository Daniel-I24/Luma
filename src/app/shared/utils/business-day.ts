/** The business day follows Colombia, like create_order (America/Bogota). */
export const BUSINESS_TIME_ZONE = 'America/Bogota';

/** BusinessDay — the calendar day in Bogotá. */
export class BusinessDay {
  /** "YYYY-MM-DD" of an instant in Bogota. */
  public static bogotaDay(instant: Date): string {
    return instant.toLocaleDateString('en-CA', { timeZone: BUSINESS_TIME_ZONE });
  }
}

