import type { BusinessHours, BusinessStatus } from '../models/business.model';

/** Minutes before opening/closing that trigger the "soon" statuses. */
const SOON_WINDOW_MINUTES = 30;

/**
 * Parses a 'HH:MM' or 'HH:MM:SS' time string into total minutes since midnight.
 */
function timeToMinutes(time: string): number {
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
 *   e.g. day_of_week=1 (Mon) with opens='18:00', closes='02:00':
 *   on Tuesday at 01:00 we must look at Monday's entry, not Tuesday's.
 *
 * Priority rule (documented):
 *   If TODAY's entry also considers the current time as open, TODAY wins.
 *   In practice well-formed schedules will never produce both at once.
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

  // ── Check whether yesterday's midnight-crossing schedule still applies ──
  const yesterdayStatus = getYesterdayMidnightStatus(
    yesterdayEntry,
    currentMinutes,
    soonWindowMinutes,
  );

  // ── Evaluate today's entry ───────────────────────────────────────────────
  if (!todayEntry || todayEntry.is_closed) {
    // Today has no schedule: fall back to yesterday's carry-over or opening-soon.
    if (yesterdayStatus !== null) return yesterdayStatus;
    return checkOpeningSoon(todayEntry, currentMinutes, soonWindowMinutes) ?? 'closed';
  }

  const opensAt = timeToMinutes(todayEntry.opens_at);
  const closesAt = timeToMinutes(todayEntry.closes_at);
  const crossesMidnight = closesAt < opensAt;

  const todayStatus = crossesMidnight
    ? getStatusForMidnightSchedule(currentMinutes, opensAt, closesAt, soonWindowMinutes)
    : getStatusForNormalSchedule(currentMinutes, opensAt, closesAt, soonWindowMinutes);

  // TODAY's result takes priority over yesterday's carry-over.
  if (isOpenStatus(todayStatus)) return todayStatus;

  // TODAY says closed/opening-soon — but yesterday's midnight window might
  // still apply (e.g. today opens at 10:00 and we are at 01:00 AM while
  // yesterday's bar was open until 03:00).
  if (yesterdayStatus !== null) return yesterdayStatus;

  return todayStatus;
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * If yesterday had a midnight-crossing schedule AND the current time
 * falls within the after-midnight window, return the appropriate status.
 * Returns null if yesterday's schedule does not apply right now.
 */
function getYesterdayMidnightStatus(
  entry: BusinessHours | undefined,
  currentMinutes: number,
  soon: number,
): BusinessStatus | null {
  if (!entry || entry.is_closed) return null;

  const opensAt = timeToMinutes(entry.opens_at);
  const closesAt = timeToMinutes(entry.closes_at);
  const crossesMidnight = closesAt < opensAt;

  if (!crossesMidnight) return null;

  // We are in the after-midnight window when current < closes_at of yesterday.
  if (currentMinutes >= closesAt) return null;

  // Business is open (after-midnight side); check closing-soon.
  return currentMinutes >= closesAt - soon ? 'closing-soon' : 'open';
}

function getStatusForNormalSchedule(
  current: number,
  opens: number,
  closes: number,
  soon: number,
): BusinessStatus {
  const isOpen = current >= opens && current < closes;

  if (isOpen) {
    return current >= closes - soon ? 'closing-soon' : 'open';
  }

  if (current < opens) {
    return current >= opens - soon ? 'opening-soon' : 'closed';
  }

  return 'closed';
}

function getStatusForMidnightSchedule(
  current: number,
  opens: number,
  closes: number,
  soon: number,
): BusinessStatus {
  const MIDNIGHT = 24 * 60;
  // Open when: current >= opens (evening) OR current < closes (after midnight, same entry day).
  const isOpen = current >= opens || current < closes;

  if (!isOpen) {
    return current >= opens - soon ? 'opening-soon' : 'closed';
  }

  if (current >= opens) {
    // Evening side: minutes until midnight + closes gives total until close.
    const minutesUntilMidnight = MIDNIGHT - current;
    const totalUntilClose = minutesUntilMidnight + closes;
    return totalUntilClose <= soon ? 'closing-soon' : 'open';
  }

  // After-midnight side (same calendar day as the entry).
  return current >= closes - soon ? 'closing-soon' : 'open';
}

/** Returns whether a status means the business is currently serving customers. */
function isOpenStatus(status: BusinessStatus): boolean {
  return status === 'open' || status === 'closing-soon';
}

/**
 * Checks if the business opens soon today (within the soon window)
 * when today's entry is missing or is_closed.
 */
function checkOpeningSoon(
  entry: BusinessHours | undefined,
  currentMinutes: number,
  soon: number,
): BusinessStatus | null {
  if (!entry || entry.is_closed) return null;

  const opensAt = timeToMinutes(entry.opens_at);
  if (currentMinutes < opensAt && currentMinutes >= opensAt - soon) {
    return 'opening-soon';
  }

  return null;
}
