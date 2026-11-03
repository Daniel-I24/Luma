/** Messages raised by the order functions (see the orders migrations). */
const ORDER_ERROR_KEYS: Readonly<Record<string, string>> = {
  not_authenticated: 'orders.errors.notAuthenticated',
  business_unavailable: 'orders.errors.businessUnavailable',
  business_closed: 'orders.errors.businessClosed',
  invalid_items: 'orders.errors.invalidItems',
  duplicate_items: 'orders.errors.invalidItems',
  item_unavailable: 'orders.errors.itemUnavailable',
  invalid_pickup_time: 'orders.errors.invalidPickupTime',
  invalid_notes: 'orders.errors.invalidNotes',
  total_too_high: 'orders.errors.totalTooHigh',
  too_many_pending: 'orders.errors.tooManyPending',
  order_not_found: 'orders.errors.notFound',
  invalid_transition: 'orders.errors.invalidTransition',
  too_many_orders: 'orders.errors.tooManyOrders',
  email_not_confirmed: 'errors.emailNotConfirmed',
  profile_incomplete: 'orders.errors.profileIncomplete',
  phone_not_verified: 'orders.errors.phoneNotVerified',
  business_paused: 'orders.errors.businessPaused',
  account_restricted: 'orders.errors.accountRestricted',
  trust_pending_limit: 'orders.errors.trustPendingLimit',
  trust_daily_limit: 'orders.errors.trustDailyLimit',
  payments_disabled: 'orders.errors.paymentsDisabled',
  invalid_payment_method: 'orders.errors.paymentsDisabled',
  reason_required: 'orders.errors.reasonRequired',
  invalid_reason: 'orders.errors.reasonRequired',
  no_show_too_early: 'orders.errors.noShowTooEarly',
};

/** The error that the customer fixes by completing their profile. */
export const PROFILE_INCOMPLETE_KEY = 'orders.errors.profileIncomplete';

/** Translation key for a database error message; a generic one otherwise. */
export function mapOrderError(message: string | undefined, fallback: string): string {
  return (message && ORDER_ERROR_KEYS[message.trim()]) || fallback;
}
