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

/** OrderBoard — tabs and allowed actions of the owner's order board. */
export class OrderBoard {
  public static orderTab(status: OrderStatus): OrderTab {
    return TAB_OF[status];
  }

  /** True once the customer had NO_SHOW_MINUTES to come since the order was ready. */
  public static noShowAllowed(readyAt: string | null, now: number): boolean {
    return readyAt !== null && now - Date.parse(readyAt) >= NO_SHOW_MINUTES * MS_PER_MINUTE;
  }

  /** What the owner can do next; mirrors the transitions set_order_status allows. */
  public static nextActions(order: Pick<BusinessOrder, 'status' | 'ready_at'>, now = Date.now()): OrderAction[] {
    const cancel: OrderAction = { status: 'cancelled', key: 'cancel', variant: 'danger', confirm: 'cancel' };
    switch (order.status) {
      case 'pending':
        return [
          { status: 'accepted', key: 'accept', variant: 'confirm', confirm: null },
          { status: 'cancelled', key: 'reject', variant: 'danger', confirm: 'reject' },
        ];
      case 'accepted':
        return [{ status: 'preparing', key: 'preparing', variant: 'confirm', confirm: null }, cancel];
      case 'preparing':
        return [{ status: 'ready', key: 'ready', variant: 'confirm', confirm: null }, cancel];
      case 'ready':
        return [
          { status: 'picked_up', key: 'deliver', variant: 'confirm', confirm: null },
          OrderBoard.noShowAllowed(order.ready_at, now)
            ? { status: 'cancelled', key: 'noShow', variant: 'danger', confirm: 'no_show' }
            : cancel,
        ];
      default:
        return [];
    }
  }

  /** Orders of one tab: active tabs oldest first (first come, first served), history newest first. */
  public static ordersOfTab(orders: readonly BusinessOrder[], tab: OrderTab): BusinessOrder[] {
    const list = orders.filter((order) => OrderBoard.orderTab(order.status) === tab);
    const byCreation = (a: BusinessOrder, b: BusinessOrder): number =>
      a.created_at.localeCompare(b.created_at);
    return tab === 'history' ? list.sort((a, b) => byCreation(b, a)) : list.sort(byCreation);
  }
}

export interface OrderAction {
  readonly status: OwnerOrderAction;
  /** Translation key under businessOrders.actions. */
  readonly key: string;
  readonly variant: 'confirm' | 'danger';
  /** Which confirmation sheet opens first, or null to act right away. */
  readonly confirm: 'reject' | 'cancel' | 'no_show' | null;
}

/** Minutes after "ready" before the owner may mark a no-show (no_show_min_minutes). */
export const NO_SHOW_MINUTES = 15;
const MS_PER_MINUTE = 60_000;
