import { MS_PER_DAY } from '@core/config/units';
import type { BusinessOrder } from '@shared/orders/business-order.repository';
import { BusinessDay } from '@shared/business/domain/opening-hours';

export interface TodayStats {
  /** Waiting for the owner to accept. */
  readonly newOrders: number;
  /** Accepted or being prepared. */
  readonly preparing: number;
  readonly ready: number;
  /** Total of today's picked-up orders, in COP. */
  readonly soldCop: number;
  /** Orders placed today and yesterday (not cancelled), for the trend. */
  readonly ordersToday: number;
  readonly ordersYesterday: number;
  readonly soldYesterdayCop: number;
}

const DAY_MS = MS_PER_DAY;

/** TodayStatsCalculator — today's orders and sales for the owner. */
export class TodayStatsCalculator {
  /** Figures of the day for the summary, from the orders placed today. */
  public static todayStats(orders: readonly BusinessOrder[], now: Date): TodayStats {
    const today = BusinessDay.bogotaDay(now);
    const yesterday = BusinessDay.bogotaDay(new Date(now.getTime() - DAY_MS));
    const on = (day: string): BusinessOrder[] => orders.filter((order) => BusinessDay.bogotaDay(new Date(order.created_at)) === day);
    const todays = on(today);
    const yesterdays = on(yesterday);
    const count = (...statuses: BusinessOrder['status'][]): number =>
      todays.filter((order) => statuses.includes(order.status)).length;
    const sold = (list: readonly BusinessOrder[]): number =>
      list.filter((order) => order.status === 'picked_up').reduce((sum, order) => sum + order.total_cop, 0);
    const placed = (list: readonly BusinessOrder[]): number => list.filter((order) => order.status !== 'cancelled').length;
    return {
      newOrders: count('pending'),
      preparing: count('accepted', 'preparing'),
      ready: count('ready'),
      soldCop: sold(todays),
      ordersToday: placed(todays),
      ordersYesterday: placed(yesterdays),
      soldYesterdayCop: sold(yesterdays),
    };
  }

  /** "up", "down" or "same" against yesterday. */
  public static trend(today: number, yesterday: number): 'up' | 'down' | 'same' {
    return today > yesterday ? 'up' : today < yesterday ? 'down' : 'same';
  }
}
