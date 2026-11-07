import { ORDER_PROGRESS, type OrderStatus } from './order.model';

export type StepState = 'done' | 'current' | 'upcoming';

export interface ProgressStep {
  readonly status: OrderStatus;
  readonly state: StepState;
}

/**
 * OrderProgress — the state of each step of an order, the same for the customer and the
 * business. The last step (picked up) has nothing after it, so reaching it completes it.
 * A cancelled or unpaid order has not started: every step is upcoming.
 */
export class OrderProgress {
  /** Each step of ORDER_PROGRESS with its state for this status. */
  public static steps(status: OrderStatus): ProgressStep[] {
    const current = ORDER_PROGRESS.indexOf(status);
    const finished = current === ORDER_PROGRESS.length - 1;
    return ORDER_PROGRESS.map((step, index) => ({
      status: step,
      state: OrderProgress.stateOf(index, current, finished),
    }));
  }

  private static stateOf(index: number, current: number, finished: boolean): StepState {
    if (current < 0 || index > current) return 'upcoming';
    if (index < current || finished) return 'done';
    return 'current';
  }
}
