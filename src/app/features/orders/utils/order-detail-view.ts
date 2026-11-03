import { ORDER_PROGRESS, type OrderStatus } from '@shared/orders/order.model';

/** OrderDetailView — timeline and estimate of an order. */
export class OrderDetailView {
  /** The estimate only matters while the order is still being prepared. */
  public static showsEstimate(status: OrderStatus): boolean {
    return status === 'pending' || status === 'accepted' || status === 'preparing';
  }

  /** State of each timeline step for the current status (all upcoming once cancelled). */
  public static timelineSteps(status: OrderStatus): { status: OrderStatus; state: StepState }[] {
    const current = ORDER_PROGRESS.indexOf(status);
    return ORDER_PROGRESS.map((step, index) => ({
      status: step,
      state:
        current < 0
          ? 'upcoming'
          : index < current
            ? 'done'
            : index === current
              ? 'current'
              : 'upcoming',
    }));
  }
}

export type StepState = 'done' | 'current' | 'upcoming';
