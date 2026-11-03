import type { PushAction } from './push-platform';

/** Route commands for Router.navigate. */
export type RouteCommands = readonly string[];

/**
 * PushRoute — the screen a tapped notification opens, from its type and ids
 * (push-dispatch data). Customers' order, payment and review notices open
 * the order; owners' order and review notices open their panel; promotions
 * open the business. Anything else, or a notice without its id, opens the
 * notification list.
 */
export class PushRoute {
  private static readonly ORDER_TYPES = new Set(['order_status', 'payment', 'review_invite']);
  private static readonly OWNER_ORDER_TYPES = new Set(['order_new', 'order_cancelled']);
  private static readonly FALLBACK: RouteCommands = ['/notifications'];

  /** Pure mapping, so it is tested without a router. */
  public static of(action: PushAction): RouteCommands {
    const { type, orderId, businessId } = action;
    if (type && PushRoute.ORDER_TYPES.has(type) && orderId) return ['/orders', orderId];
    if (!type || !businessId) return PushRoute.FALLBACK;
    if (PushRoute.OWNER_ORDER_TYPES.has(type)) return ['/owner', businessId, 'orders'];
    if (type === 'business_review') return ['/owner', businessId, 'summary'];
    if (type === 'promotion') return ['/businesses', businessId];
    return PushRoute.FALLBACK;
  }
}
