import type { BusinessHours, BusinessStatus } from '../models/business.model';
import {
  getStatusForNormalSchedule,
  isOpenStatus,
  checkOpeningSoon,
} from './business-status-normal.util';
import {
  getStatusForMidnightSchedule,
  getYesterdayMidnightStatus,
} from './business-status-midnight.util';

/** Minutes before opening/closing that trigger the "soon" statuses. */
const SOON_WINDOW_MINUTES = 30;

/**
 * Parses a 'HH:MM' or 'HH:MM:SS' time string into total minutes since midnight.
 * Exported so sibling util files can reuse it without a circular dependency.
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * getBusinessStatus — pure function; no network calls, fully testable.
 *
 * Returns the operational status of a business at a given moment.
 *
 * Midnight-crossing schedules (closes_at < opens_at):
 *   The "after-midnight" window belongs to the PREVIOUS calendar day.
 *   Example: day_of_week=1 (Mon) opens='18:00', closes='02:00'.
 *   On Tuesday at 01:00 we must check Monday's entry, not Tuesday's.
 *
 * Priority rule (documented):
 *   If TODAY's entry indicates open/closing-soon, TODAY wins over any
 *   midnight carry-over from yesterday. Well-formed schedules should
 *   never produce both at once.
 *
 * @param hours             Full week schedule (up to 7 entries).
 * @param now               Moment to evaluate (defaults to new Date()).
 * @param soonWindowMinutes Threshold in minutes for "soon" states (default 30).
 */
export function getBusinessStatus(
  hours: BusinessHours[],
  now: Date = new Date(),
  soonWindowMinutes = SOON_WINDOW_MINUTES,
): BusinessStatus {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay() as BusinessHours['day_of_week'];
  const yesterday = ((today + 6) % 7) as BusinessHours['day_of_week'];

  const todayEntry = hours.find((h) => h.day_of_week === today);
  const yesterdayEntry = hours.find((h) => h.day_of_week === yesterday);

  // Check whether yesterday's midnight-crossing schedule still applies now.
  const yesterdayStatus = getYesterdayMidnightStatus(
    yesterdayEntry,
    currentMinutes,
    soonWindowMinutes,
  );

  if (!todayEntry || todayEntry.is_closed) {
    if (yesterdayStatus !== null) return yesterdayStatus;
    return checkOpeningSoon(todayEntry, currentMinutes, soonWindowMinutes) ?? 'closed';
  }

  const opensAt = timeToMinutes(todayEntry.opens_at);
  const closesAt = timeToMinutes(todayEntry.closes_at);
  const crossesMidnight = closesAt < opensAt;

  const todayStatus = crossesMidnight
    ? getStatusForMidnightSchedule(currentMinutes, opensAt, closesAt, soonWindowMinutes)
    : getStatusForNormalSchedule(currentMinutes, opensAt, closesAt, soonWindowMinutes);

  // TODAY's open status takes priority over yesterday's carry-over.
  if (isOpenStatus(todayStatus)) return todayStatus;
  if (yesterdayStatus !== null) return yesterdayStatus;

  return todayStatus;
}
