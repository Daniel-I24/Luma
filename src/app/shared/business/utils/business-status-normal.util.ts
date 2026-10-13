import type { BusinessHours, BusinessStatus } from '../models/business.model';

/**
 * Evaluates status for a schedule that does NOT cross midnight.
 * All times are in minutes since midnight.
 */
export function getStatusForNormalSchedule(
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

/**
 * Returns whether a status means the business is currently serving customers.
 * Used to apply the "today has priority over yesterday" rule.
 */
export function isOpenStatus(status: BusinessStatus): boolean {
  return status === 'open' || status === 'closing-soon';
}

/**
 * Checks if the business opens soon today (within the soon window)
 * when today's entry is missing or is_closed.
 * Returns null if no upcoming opening is within the window.
 */
export function checkOpeningSoon(
  entry: BusinessHours | undefined,
  currentMinutes: number,
  soon: number,
): BusinessStatus | null {
  if (!entry || entry.is_closed) return null;

  const opensAt = timeToMinutesLocal(entry.opens_at);
  if (currentMinutes < opensAt && currentMinutes >= opensAt - soon) {
    return 'opening-soon';
  }

  return null;
}

// Re-exported so callers in this file don't need a cross-import.
function timeToMinutesLocal(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
