import { OpeningHours, SOON_WINDOW_MINUTES } from '../domain/opening-hours';
import type { BusinessHours, BusinessStatus } from '../models/business.model';

/** BusinessStatusRules — open, closing soon, closed or opening soon. */
export class BusinessStatusRules {
  /**
   * Status of a business at a moment (open, closing soon, opening soon or
   * closed), from the app's single opening-hours rule (OpeningHours).
   */
  public static getBusinessStatus(
    hours: readonly BusinessHours[],
    now: Date = new Date(),
    soonWindowMinutes = SOON_WINDOW_MINUTES,
  ): BusinessStatus {
    return OpeningHours.from(hours).statusAt(now, soonWindowMinutes);
  }

  /** Whether a status means the business is serving customers now. */
  public static isOpenStatus(status: BusinessStatus): boolean {
    return status === 'open' || status === 'closing-soon';
  }
}

