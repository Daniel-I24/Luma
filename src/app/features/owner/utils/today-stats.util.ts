import type { BusinessOrder } from '@shared/orders/business-order.repository';
import { bogotaDay } from '@shared/utils/business-day';

export interface TodayStats {
  /** Waiting for the owner to accept. */
  readonly newOrders: number;
  /** Accepted or being prepared. */
  readonly preparing: number;
  readonly ready: number;
  /** Total of today's picked-up orders, in COP. */
  readonly soldCop: number;
}

/** Figures of the day for the summary, from the orders placed today. */
export function todayStats(orders: readonly BusinessOrder[], now: Date): TodayStats {
  const today = bogotaDay(now);
  const todays = orders.filter((order) => bogotaDay(new Date(order.created_at)) === today);
  const count = (...statuses: BusinessOrder['status'][]) =>
    todays.filter((order) => statuses.includes(order.status)).length;
  return {
    newOrders: count('pending'),
    preparing: count('accepted', 'preparing'),
    ready: count('ready'),
    soldCop: todays
      .filter((order) => order.status === 'picked_up')
      .reduce((sum, order) => sum + order.total_cop, 0),
  };
}
