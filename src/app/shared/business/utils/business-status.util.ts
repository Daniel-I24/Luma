import { OpeningHours, SOON_WINDOW_MINUTES } from '../domain/opening-hours';
import type { BusinessHours, BusinessStatus } from '../models/business.model';

/**
 * Status of a business at a moment (open, closing soon, opening soon or
 * closed), from the app's single opening-hours rule (OpeningHours).
 */
export function getBusinessStatus(
  hours: readonly BusinessHours[],
  now: Date = new Date(),
  soonWindowMinutes = SOON_WINDOW_MINUTES,
): BusinessStatus {
  return OpeningHours.from(hours).statusAt(now, soonWindowMinutes);
}

/** Whether a status means the business is serving customers now. */
export function isOpenStatus(status: BusinessStatus): boolean {
  return status === 'open' || status === 'closing-soon';
}
