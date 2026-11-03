import { ORDER_PROGRESS, type OrderBusiness, type OrderStatus } from '@shared/orders/order.model';
import { ExternalUrls } from '@core/config/external-urls';

/** OrderDetailView — timeline, estimate and directions of an order. */
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

  /** Directions to the business in the user's maps app. */
  public static directionsUrl(business: Pick<OrderBusiness, 'latitude' | 'longitude'>): string {
    const destination = `${business.latitude},${business.longitude}`;
    return ExternalUrls.directions(destination);
  }
}

export type StepState = 'done' | 'current' | 'upcoming';
