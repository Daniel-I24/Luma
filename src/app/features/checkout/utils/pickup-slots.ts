import { OpeningHours, ClockTime } from '@shared/business/domain/opening-hours';
import type { BusinessHours } from '@shared/business/models/business.model';
import { MIN_LEAD_MINUTES } from './pickup-time';
import { CLOCK_FIELD_DIGITS, MINUTES_PER_HOUR } from '@core/config/units';

/** Pick-up times are offered every 15 minutes. */
export const SLOT_STEP_MINUTES = 15;
const MINUTE_MS = 60_000;

const pad = (n: number): string => String(n).padStart(CLOCK_FIELD_DIGITS, '0');

/** PickupSlots — the pick-up times a business offers on a day and their ranges. */
export class PickupSlots {
  public static readonly minutesToTime = (minutes: number): string =>
    `${pad(Math.floor(minutes / MINUTES_PER_HOUR))}:${pad(minutes % MINUTES_PER_HOUR)}`;

  /**
   * "HH:MM" pick-up times offered on `date`'s calendar day: inside the opening
   * windows of the single opening-hours rule (OpeningHours), every 15
   * minutes, before closing and at least 10 minutes after `now` (the same
   * lead the server enforces).
   */
  public static pickupSlots(hours: readonly BusinessHours[], date: Date, now: Date): string[] {
    const midnight = new Date(date);
    midnight.setHours(0, 0, 0, 0);
    const earliest = now.getTime() + MIN_LEAD_MINUTES * MINUTE_MS;
    const slots: string[] = [];
    for (const window of OpeningHours.from(hours).windowsFor(date.getDay())) {
      const first = Math.ceil(window.from / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;
      for (let minutes = first; minutes < window.to; minutes += SLOT_STEP_MINUTES) {
        const at = new Date(midnight);
        at.setHours(0, minutes, 0, 0);
        if (at.getTime() >= earliest) slots.push(PickupSlots.minutesToTime(minutes));
      }
    }
    return slots;
  }

  /** Consecutive slots grouped as "first–last" ranges, for the hint text. */
  public static slotRanges(slots: readonly string[]): string[] {
    const ranges: string[] = [];
    let start = 0;
    for (let i = 1; i <= slots.length; i++) {
      const gap =
        i === slots.length ||
        ClockTime.timeToMinutes(slots[i]) - ClockTime.timeToMinutes(slots[i - 1]) !== SLOT_STEP_MINUTES;
      if (!gap) continue;
      ranges.push(start === i - 1 ? slots[start] : `${slots[start]}–${slots[i - 1]}`);
      start = i;
    }
    return ranges;
  }
}

