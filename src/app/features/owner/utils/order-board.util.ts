import type { BusinessOrder, OwnerOrderAction } from '@shared/orders/business-order.repository';
import type { OrderStatus } from '@shared/orders/order.model';

/** Tabs of the orders board, in display order. */
export const ORDER_TABS = ['new', 'preparing', 'ready', 'history'] as const;
export type OrderTab = (typeof ORDER_TABS)[number];

const TAB_OF: Record<OrderStatus, OrderTab> = {
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
  /** Asks for confirmation first. */
  readonly confirm: boolean;
}

/** What the owner can do next; mirrors the transitions set_order_status allows. */
export function nextActions(status: OrderStatus): OrderAction[] {
  switch (status) {
    case 'pending':
      return [
        { status: 'accepted', key: 'accept', variant: 'primary', confirm: false },
        { status: 'cancelled', key: 'reject', variant: 'danger-outline', confirm: true },
      ];
    case 'accepted':
      return [{ status: 'preparing', key: 'preparing', variant: 'primary', confirm: false }];
    case 'preparing':
      return [{ status: 'ready', key: 'ready', variant: 'primary', confirm: false }];
    case 'ready':
      return [{ status: 'picked_up', key: 'deliver', variant: 'primary', confirm: false }];
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
