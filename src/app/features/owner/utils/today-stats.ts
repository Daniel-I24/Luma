import type { BusinessOrder } from '@shared/orders/business-order.repository';
import { BusinessDay } from '@shared/utils/business-day';

export interface TodayStats {
  /** Waiting for the owner to accept. */
  readonly newOrders: number;
  /** Accepted or being prepared. */
  readonly preparing: number;
  readonly ready: number;
  /** Total of today's picked-up orders, in COP. */
  readonly soldCop: number;
}

/** TodayStatsCalculator — today's orders and sales for the owner. */
export class TodayStatsCalculator {
  /** Figures of the day for the summary, from the orders placed today. */
  public static todayStats(orders: readonly BusinessOrder[], now: Date): TodayStats {
    const today = BusinessDay.bogotaDay(now);
    const todays = orders.filter((order) => BusinessDay.bogotaDay(new Date(order.created_at)) === today);
    const count = (...statuses: BusinessOrder['status'][]): number =>
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
}

