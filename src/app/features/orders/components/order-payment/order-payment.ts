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
  template: `
    <section *transloco="let t" class="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4" aria-labelledby="order-payment-title">
      <h2 id="order-payment-title" class="m-0 text-title text-fg">{{ t('payments.title') }}</h2>
      <p class="m-0 inline-flex items-center gap-1 self-start rounded-full px-3 py-1 text-label" [class]="tone()" role="status">
        @if (status() === 'approved') {
        <app-luma-checkmark [size]="16" />
        }
        {{ t('payments.status.' + status()) }}
      </p>

      @if (awaiting()) { @if (payment.canStillPay()) {
      <p class="m-0 text-body-sm text-fg-muted">
        {{ t('payments.attemptsLeft', { count: payment.attemptsLeft() }) }}
      </p>
      }
      <app-luma-button
        variant="primary"
        [fullWidth]="true"
        [disabled]="payment.busy() || payment.blockedKey() !== null"
        (clicked)="payment.pay()"
        >{{ t(payment.busy() ? 'payments.opening' : payKey()) }}</app-luma-button
      >
      @if (payment.blockedKey(); as cause) {
      <p class="m-0 text-body-sm text-fg-muted" role="status">{{ t(cause, { time: payment.waitLabel() }) }}</p>
      } @if (!payment.canStillPay()) {
      <p class="m-0 text-body-sm text-fg-muted">{{ t('payments.noMoreAttempts') }}</p>
      } } @if (payment.errorKey(); as key) {
      <p class="m-0 rounded-md bg-danger-bg p-3 text-body-sm text-danger-fg" role="alert">{{ t(key) }}</p>
      } @if (status() === 'refund_required') {
      <p class="m-0 text-body-sm text-fg-muted">{{ t('payments.refundInfo') }}</p>
      }
    </section>
  `,
})
export class OrderPayment {
  protected readonly payment = inject(OrderPaymentStore);

  public readonly order = input.required<OrderWithItems>();

  protected readonly awaiting = computed(() => this.order().status === 'awaiting_payment');
  protected readonly status = computed(() => this.order().payment_status);
  protected readonly tone = computed(() => TONE[this.status()] ?? 'bg-warning-bg text-warning-fg');
  /** "Pagar" before any attempt, "Reintentar pago" after one (failed or still open). */
  protected readonly payKey = computed(() => (this.status() === 'none' ? 'payments.pay' : 'payments.retry'));

  constructor() {
    // Re-read attempts whenever the order (re-fetched on resume or by polling) changes.
    effect(() => {
      const order = this.order();
      untracked(() => void this.payment.load(order.id));
    });
  }
}
