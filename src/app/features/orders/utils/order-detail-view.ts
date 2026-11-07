import type { Order, OrderStatus } from '@shared/orders/order.model';

/** OrderDetailView — timeline and estimate of an order. */
export class OrderDetailView {
  /** The estimate only matters while the order is still being prepared. */
  public static showsEstimate(status: OrderStatus): boolean {
    return status === 'pending' || status === 'accepted' || status === 'preparing';
  }

  /** The server's rule (cancel_order): until the kitchen starts. */
  public static canCancel(status: OrderStatus): boolean {
    return status === 'awaiting_payment' || status === 'pending' || status === 'accepted';
  }

  /** Too late: the screen says why there is no button. */
  public static cancelLocked(status: OrderStatus): boolean {
    return status === 'preparing' || status === 'ready';
  }

  /** Why a cancelled order ended, in the customer's words. */
  public static cancelledKey(reason: Order['cancel_reason']): string {
    if (reason === 'customer') return 'orders.detail.cancelledByYou';
    if (reason === 'payment_expired') return 'orders.detail.paymentExpired';
    return reason ? 'orders.detail.cancelledByBusiness' : 'orders.detail.cancelled';
  }
}
