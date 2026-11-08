import type { Order } from './order.model';
import { MS_PER_MINUTE } from '@core/config/units';

/** Used when the business's preparation time is not available. */
const DEFAULT_PREP_MINUTES = 20;

/** OrderEstimates — when an order should be ready. */
export class OrderEstimates {
  /**
   * When the order should be ready: the requested pick-up time ("Para recoger
   * a las HH:MM") or, as soon as possible, created_at + prep_minutes
   * ("Listo aprox. a las HH:MM").
   */
  public static estimateReadyAt(
    order: Pick<Order, 'pickup_at' | 'created_at'>,
    prepMinutes: number | null | undefined,
  ): ReadyEstimate {
    if (order.pickup_at) return { kind: 'pickup', at: order.pickup_at };
    const minutes = prepMinutes ?? DEFAULT_PREP_MINUTES;
    return {
      kind: 'ready',
      at: new Date(Date.parse(order.created_at) + minutes * MS_PER_MINUTE).toISOString(),
    };
  }
}

export interface ReadyEstimate {
  /** 'pickup': the requested time; 'ready': creation + preparation time. */
  readonly kind: 'pickup' | 'ready';
  readonly at: string;
}
