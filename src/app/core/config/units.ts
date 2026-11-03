

/**
 * Units used across the app, so arithmetic reads as what it means
 * (`minutes * MS_PER_MINUTE`) instead of bare numbers.
 */
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60_000;
export const MS_PER_DAY = 86_400_000;
export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 1440;
export const DAYS_PER_WEEK = 7;
export const METERS_PER_KM = 1000;
export const BYTES_PER_MB = 1_048_576;
export const PERCENT = 100;
/** Multiply by HALF to find the centre of a length. */
export const HALF = 0.5;
/** Two-digit clock fields ("07:05"). */
export const CLOCK_FIELD_DIGITS = 2;
/** Base of `Number#toString` for short random ids. */
export const RADIX_36 = 36;
