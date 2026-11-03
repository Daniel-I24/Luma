import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaCheckmark } from '@design-system';
import type { OrderWithItems } from '@shared/orders/order.model';
import { OrderPaymentStore } from '../../state/order-payment.store';

const TONE: Readonly<Record<string, string>> = {
  approved: 'bg-success-bg text-success-fg',
  refunded: 'bg-success-bg text-success-fg',
  declined: 'bg-danger-bg text-danger-fg',
  error: 'bg-danger-bg text-danger-fg',
  voided: 'bg-canvas-subtle text-fg-muted',
};

/**
 * OrderPayment — status of an online payment on the order screen and, while
 * the order waits for it, "Pagar" / "Reintentar pago" (3 attempts, before the
 * order expires). The status shown always comes from the server.
 */
@Component({
  selector: 'app-order-payment',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaCheckmark],
  providers: [OrderPaymentStore],
  templateUrl: './order-payment.html',
})
export class OrderPayment {
  protected readonly payment = inject(OrderPaymentStore);

  public readonly order = input.required<OrderWithItems>();

  protected readonly awaiting = computed(() => this.order().status === 'awaiting_payment');
  protected readonly status = computed(() => this.order().payment_status);
  protected readonly tone = computed(() => TONE[this.status()] ?? 'bg-warning-bg text-warning-fg');
  /** "Pagar" before any attempt, "Reintentar pago" after a failed one. */
  protected readonly payKey = computed(() =>
    this.status() === 'declined' || this.status() === 'error' ? 'payments.retry' : 'payments.pay',
  );

  public constructor() {
    // Re-read attempts whenever the order (re-fetched on resume or by polling) changes.
    effect(() => {
      const order = this.order();
      untracked(() => void this.payment.load(order.id));
    });
  }
}
