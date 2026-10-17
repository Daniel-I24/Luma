import {
  ORDER_PROGRESS,
  type Order,
  type OrderBusiness,
  type OrderStatus,
} from '@shared/orders/order.model';

/** Client-side estimate of preparation time for "as soon as possible" orders (docs/mocks.md). */
export const ESTIMATED_PREP_MINUTES = 20;

/** When the order should be ready: the requested time, or creation + estimate. */
export function estimatedReadyAt(order: Pick<Order, 'pickup_at' | 'created_at'>): string {
  if (order.pickup_at) return order.pickup_at;
  return new Date(
    new Date(order.created_at).getTime() + ESTIMATED_PREP_MINUTES * 60_000,
  ).toISOString();
}

/** The estimate only matters while the order is still being prepared. */
export function showsEstimate(status: OrderStatus): boolean {
  return status === 'pending' || status === 'accepted' || status === 'preparing';
}

export type StepState = 'done' | 'current' | 'upcoming';

/** State of each timeline step for the current status (all upcoming once cancelled). */
export function timelineSteps(status: OrderStatus): { status: OrderStatus; state: StepState }[] {
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
export function directionsUrl(business: Pick<OrderBusiness, 'latitude' | 'longitude'>): string {
  const destination = `${business.latitude},${business.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
