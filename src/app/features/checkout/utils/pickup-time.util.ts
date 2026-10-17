/** "Ahora" (as soon as possible), "Más tarde" (today) or "Mañana". */
export type PickupOption = 'now' | 'later' | 'tomorrow';

/** Same window the server enforces in create_order. */
export const MIN_LEAD_MINUTES = 10;
export const MAX_AHEAD_DAYS = 7;
/** Suggested lead time for "Más tarde". */
const SUGGESTED_LEAD_MINUTES = 30;
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

/** Turns the checkout choice into the pick-up time to send. */
export function resolvePickup(option: PickupOption, time: string, now: Date = new Date()): PickupChoice {
  if (option === 'now') return { pickupAt: null, errorKey: null };
  const parsed = parseTime(time);
  if (!parsed) return { pickupAt: null, errorKey: 'checkout.errors.timeRequired' };

  const at = new Date(now);
  if (option === 'tomorrow') at.setDate(at.getDate() + 1);
  at.setHours(parsed[0], parsed[1], 0, 0);

  const lead = (at.getTime() - now.getTime()) / MINUTE_MS;
  if (lead < MIN_LEAD_MINUTES) return { pickupAt: null, errorKey: 'checkout.errors.tooSoon' };
  if (lead > MAX_AHEAD_DAYS * 24 * 60) return { pickupAt: null, errorKey: 'checkout.errors.tooFar' };
  return { pickupAt: at.toISOString(), errorKey: null };
}

/** Default "Más tarde" time: half an hour from now, rounded up to 5 minutes. */
export function suggestedLaterTime(now: Date = new Date()): string {
  const at = new Date(now.getTime() + SUGGESTED_LEAD_MINUTES * MINUTE_MS);
  at.setMinutes(Math.ceil(at.getMinutes() / 5) * 5, 0, 0);
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}
