import type { BusinessHours, BusinessStatus } from '../models/business.model';
import { timeToMinutes } from './business-status.util';

/**
 * Evaluates status for a schedule that crosses midnight (closes_at < opens_at).
 * All times are in minutes since midnight.
 *
 * The entry's day_of_week is the OPENING day; the closing time falls the
 * next calendar day. This function handles both the evening side and the
 * after-midnight side when the entry itself is today's entry.
 */
export function getStatusForMidnightSchedule(
  current: number,
  opens: number,
  closes: number,
  soon: number,
): BusinessStatus {
  const MIDNIGHT = 24 * 60;
  // Open when: current >= opens (evening) OR current < closes (same entry day, after midnight).
  const isOpen = current >= opens || current < closes;

  if (!isOpen) {
    return current >= opens - soon ? 'opening-soon' : 'closed';
  }

  if (current >= opens) {
    // Evening side: total minutes until close spans midnight.
    const minutesUntilMidnight = MIDNIGHT - current;
    const totalUntilClose = minutesUntilMidnight + closes;
    return totalUntilClose <= soon ? 'closing-soon' : 'open';
  }

  // After-midnight side (same calendar day as the entry).
  return current >= closes - soon ? 'closing-soon' : 'open';
}

/**
 * If yesterday had a midnight-crossing schedule AND the current time
 * falls within the after-midnight window, return the appropriate status.
 *
 * Returns null when yesterday's schedule does not apply right now, so the
 * caller can fall through to today's evaluation.
 */
export function getYesterdayMidnightStatus(
  entry: BusinessHours | undefined,
  currentMinutes: number,
  soon: number,
): BusinessStatus | null {
  if (!entry || entry.is_closed) return null;

  const opensAt = timeToMinutes(entry.opens_at);
  const closesAt = timeToMinutes(entry.closes_at);
  const crossesMidnight = closesAt < opensAt;

  if (!crossesMidnight) return null;

  // After-midnight window: current time must be before closes_at of yesterday.
  if (currentMinutes >= closesAt) return null;

  return currentMinutes >= closesAt - soon ? 'closing-soon' : 'open';
}
