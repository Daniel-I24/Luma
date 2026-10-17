import type { BusinessHours } from '@shared/business/models/business.model';
import { timeToMinutes } from '@shared/business/utils/business-status.util';
import { MIN_LEAD_MINUTES } from './pickup-time.util';

/** Pick-up times are offered every 15 minutes. */
export const SLOT_STEP_MINUTES = 15;
const DAY_MINUTES = 24 * 60;
const MINUTE_MS = 60_000;

/** An opening window inside one calendar day, in minutes; `to` is exclusive. */
export interface DayWindow {
  readonly from: number;
  readonly to: number;
}

/**
 * Opening windows that fall on a calendar day: the after-midnight tail of the
 * previous day's hours (when they cross midnight) and the day's own hours,
 * cut at midnight when they cross it.
 */
export function windowsForDay(hours: readonly BusinessHours[], day: number): DayWindow[] {
  const windows: DayWindow[] = [];
  const previous = hours.find((h) => h.day_of_week === (day + 6) % 7);
  if (previous && !previous.is_closed) {
    const opens = timeToMinutes(previous.opens_at);
    const closes = timeToMinutes(previous.closes_at);
    if (closes < opens && closes > 0) windows.push({ from: 0, to: closes });
  }
  const own = hours.find((h) => h.day_of_week === day);
  if (own && !own.is_closed) {
    const opens = timeToMinutes(own.opens_at);
    const closes = timeToMinutes(own.closes_at);
    if (closes < opens) windows.push({ from: opens, to: DAY_MINUTES });
    else if (closes > opens) windows.push({ from: opens, to: closes });
  }
  return windows;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const minutesToTime = (minutes: number) =>
  `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/**
 * "HH:MM" pick-up times offered on `date`'s calendar day: inside the opening
 * windows, every 15 minutes, before closing and at least 10 minutes after
 * `now` (the same lead the server enforces).
 */
export function pickupSlots(hours: readonly BusinessHours[], date: Date, now: Date): string[] {
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);
  const earliest = now.getTime() + MIN_LEAD_MINUTES * MINUTE_MS;
  const slots: string[] = [];
  for (const window of windowsForDay(hours, date.getDay())) {
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
