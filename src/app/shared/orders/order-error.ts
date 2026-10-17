/** Messages raised by the order functions (see the orders migrations). */
const ORDER_ERROR_KEYS: Readonly<Record<string, string>> = {
  not_authenticated: 'orders.errors.notAuthenticated',
  business_unavailable: 'orders.errors.businessUnavailable',
  invalid_items: 'orders.errors.invalidItems',
  duplicate_items: 'orders.errors.invalidItems',
  item_unavailable: 'orders.errors.itemUnavailable',
  invalid_pickup_time: 'orders.errors.invalidPickupTime',
  invalid_notes: 'orders.errors.invalidNotes',
  total_too_high: 'orders.errors.totalTooHigh',
  too_many_pending: 'orders.errors.tooManyPending',
  order_not_found: 'orders.errors.notFound',
  invalid_transition: 'orders.errors.invalidTransition',
};

/** Translation key for a database error message; a generic one otherwise. */
export function mapOrderError(message: string | undefined, fallback: string): string {
  return (message && ORDER_ERROR_KEYS[message.trim()]) || fallback;
}
