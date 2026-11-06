/** How the customer reached the order screen, from the router state. */
export type OrderArrival = 'placed' | 'paid' | null;

/**
 * OrderCelebration — when the order screen plays its success moment: just
 * placed, back from a payment that the server says was approved, or a payment
 * approved while it is open. Opening an old paid order plays nothing.
 */
export class OrderCelebration {
  /** Reads the arrival kept in the router state. */
  public static arrivalOf(state: unknown): OrderArrival {
    const arrival = (state as { arrival?: unknown } | null | undefined)?.arrival;
    return arrival === 'placed' || arrival === 'paid' ? arrival : null;
  }

  /** `wasPaid` is null on the first read of the order. */
  public static plays(arrival: OrderArrival, wasPaid: boolean | null, isPaid: boolean): boolean {
    if (wasPaid === null) return arrival === 'placed' || (arrival === 'paid' && isPaid);
    return !wasPaid && isPaid;
  }
}
