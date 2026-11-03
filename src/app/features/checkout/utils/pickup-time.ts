import { MINUTES_PER_DAY } from '@core/config/units';
/** "Ahora" (as soon as possible), "Más tarde" (today) or "Mañana". */
export type PickupOption = 'now' | 'later' | 'tomorrow';

/** Same window the server enforces in create_order. */
export const MIN_LEAD_MINUTES = 10;
const MAX_AHEAD_DAYS = 7;
const MINUTE_MS = 60_000;

export interface PickupChoice {
  /** ISO time to send, or null for as soon as possible. */
  pickupAt: string | null;
  /** Translation key when the choice is not valid. */
  errorKey: string | null;
}

/** "HH:MM" (24 h) → hours and minutes, or null when malformed. */
function parseTime(time: string): [number, number] | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

/** PickupTime — resolves the requested pick-up time. */
export class PickupTime {
  /** Turns the checkout choice into the pick-up time to send. */
  public static resolvePickup(
    option: PickupOption,
    time: string,
    now: Date = new Date(),
  ): PickupChoice {
    if (option === 'now') return { pickupAt: null, errorKey: null };
    const parsed = parseTime(time);
    if (!parsed) return { pickupAt: null, errorKey: 'checkout.errors.timeRequired' };
  
    const at = new Date(now);
    if (option === 'tomorrow') at.setDate(at.getDate() + 1);
    at.setHours(parsed[0], parsed[1], 0, 0);
  
    const lead = (at.getTime() - now.getTime()) / MINUTE_MS;
    if (lead < MIN_LEAD_MINUTES) return { pickupAt: null, errorKey: 'checkout.errors.tooSoon' };
    if (lead > MAX_AHEAD_DAYS * MINUTES_PER_DAY)
      return { pickupAt: null, errorKey: 'checkout.errors.tooFar' };
    return { pickupAt: at.toISOString(), errorKey: null };
  }
}

