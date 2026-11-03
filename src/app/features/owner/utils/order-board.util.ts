import type { BusinessOrder, OwnerOrderAction } from '@shared/orders/business-order.repository';
import type { OrderStatus } from '@shared/orders/order.model';

/** Tabs of the orders board, in display order. */
export const ORDER_TABS = ['new', 'preparing', 'ready', 'history'] as const;
export type OrderTab = (typeof ORDER_TABS)[number];

const TAB_OF: Record<OrderStatus, OrderTab> = {
  // Never shown to the owner (business_orders leaves them out); kept for completeness.
  awaiting_payment: 'new',
  pending: 'new',
  accepted: 'preparing',
  preparing: 'preparing',
  ready: 'ready',
  picked_up: 'history',
  cancelled: 'history',
};

export function orderTab(status: OrderStatus): OrderTab {
  return TAB_OF[status];
}

export interface OrderAction {
  readonly status: OwnerOrderAction;
  /** Translation key under businessOrders.actions. */
  readonly key: string;
  readonly variant: 'primary' | 'secondary' | 'danger-outline';
  /** Which confirmation sheet opens first, or null to act right away. */
  readonly confirm: 'reject' | 'cancel' | 'no_show' | null;
}

/** Minutes after "ready" before the owner may mark a no-show (no_show_min_minutes). */
export const NO_SHOW_MINUTES = 15;
const MS_PER_MINUTE = 60_000;

/** True once the customer had NO_SHOW_MINUTES to come since the order was ready. */
export function noShowAllowed(readyAt: string | null, now: number): boolean {
  return readyAt !== null && now - Date.parse(readyAt) >= NO_SHOW_MINUTES * MS_PER_MINUTE;
}

/** What the owner can do next; mirrors the transitions set_order_status allows. */
export function nextActions(order: Pick<BusinessOrder, 'status' | 'ready_at'>, now = Date.now()): OrderAction[] {
  const cancel: OrderAction = { status: 'cancelled', key: 'cancel', variant: 'danger-outline', confirm: 'cancel' };
  switch (order.status) {
    case 'pending':
      return [
        { status: 'accepted', key: 'accept', variant: 'primary', confirm: null },
        { status: 'cancelled', key: 'reject', variant: 'danger-outline', confirm: 'reject' },
      ];
    case 'accepted':
      return [{ status: 'preparing', key: 'preparing', variant: 'primary', confirm: null }, cancel];
    case 'preparing':
      return [{ status: 'ready', key: 'ready', variant: 'primary', confirm: null }, cancel];
    case 'ready':
      return [
        { status: 'picked_up', key: 'deliver', variant: 'primary', confirm: null },
        noShowAllowed(order.ready_at, now)
          ? { status: 'cancelled', key: 'noShow', variant: 'danger-outline', confirm: 'no_show' }
          : cancel,
      ];
    default:
      return [];
  }
}

/** Orders of one tab: active tabs oldest first (first come, first served), history newest first. */
export function ordersOfTab(orders: readonly BusinessOrder[], tab: OrderTab): BusinessOrder[] {
  const list = orders.filter((order) => orderTab(order.status) === tab);
  const byCreation = (a: BusinessOrder, b: BusinessOrder) =>
    a.created_at.localeCompare(b.created_at);
  return tab === 'history' ? list.sort((a, b) => byCreation(b, a)) : list.sort(byCreation);
}
