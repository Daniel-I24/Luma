import { OpeningHours, timeToMinutes } from '@shared/business/domain/opening-hours';
import type { BusinessHours } from '@shared/business/models/business.model';
import { MIN_LEAD_MINUTES } from './pickup-time.util';

/** Pick-up times are offered every 15 minutes. */
export const SLOT_STEP_MINUTES = 15;
const MINUTE_MS = 60_000;

const pad = (n: number) => String(n).padStart(2, '0');
export const minutesToTime = (minutes: number) =>
  `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/**
 * "HH:MM" pick-up times offered on `date`'s calendar day: inside the opening
 * windows of the single opening-hours rule (OpeningHours), every 15
 * minutes, before closing and at least 10 minutes after `now` (the same
 * lead the server enforces).
 */
export function pickupSlots(hours: readonly BusinessHours[], date: Date, now: Date): string[] {
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);
  const earliest = now.getTime() + MIN_LEAD_MINUTES * MINUTE_MS;
  const slots: string[] = [];
  for (const window of OpeningHours.from(hours).windowsFor(date.getDay())) {
    const first = Math.ceil(window.from / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;
    for (let minutes = first; minutes < window.to; minutes += SLOT_STEP_MINUTES) {
      const at = new Date(midnight);
      at.setHours(0, minutes, 0, 0);
      if (at.getTime() >= earliest) slots.push(minutesToTime(minutes));
    }
  }
  return slots;
}

/** Consecutive slots grouped as "first–last" ranges, for the hint text. */
export function slotRanges(slots: readonly string[]): string[] {
  const ranges: string[] = [];
  let start = 0;
  for (let i = 1; i <= slots.length; i++) {
    const gap =
      i === slots.length ||
      timeToMinutes(slots[i]) - timeToMinutes(slots[i - 1]) !== SLOT_STEP_MINUTES;
    if (!gap) continue;
    ranges.push(start === i - 1 ? slots[start] : `${slots[start]}–${slots[i - 1]}`);
    start = i;
  }
  return ranges;
}
