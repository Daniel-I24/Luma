import { Injectable, computed, inject, signal } from '@angular/core';
import { PaymentGatewayFactory } from '@shared/payments/payment-gateway';
import { type OrderPayment, PaymentRepository } from '@shared/payments/payment.repository';

/**
 * OrderPaymentStore — the online payment of one order as the server has it
 * (my_order_payment): status, attempts left and when the unpaid order
 * expires; "Reintentar pago" opens a new Wompi checkout. Never decides that
 * an order is paid: only the server does, after Wompi confirms it.
 */
@Injectable()
export class OrderPaymentStore {
  private readonly payments = inject(PaymentRepository);
  private readonly gateways = inject(PaymentGatewayFactory);

  private readonly _payment = signal<OrderPayment | null>(null);
  private readonly _busy = signal(false);
  private readonly _errorKey = signal<string | null>(null);
  private orderId: string | null = null;

  public readonly payment = this._payment.asReadonly();
  public readonly busy = this._busy.asReadonly();
  public readonly errorKey = this._errorKey.asReadonly();
  public readonly attemptsLeft = computed(() => {
    const payment = this._payment();
    return payment ? Math.max(payment.attemptsMax - payment.attemptsUsed, 0) : 0;
  });

  public async load(orderId: string): Promise<void> {
    this.orderId = orderId;
    const result = await this.payments.orderPayment(orderId);
    if (result.data) this._payment.set(result.data);
  }

  /** True while the waiting time for the payment has not run out. */
  public canStillPay(now = Date.now()): boolean {
    const expires = this._payment()?.expiresAt;
    return this.attemptsLeft() > 0 && (!expires || Date.parse(expires) > now);
  }

  /** Opens a new checkout attempt; the order screen re-reads the server on return. */
  public async pay(): Promise<void> {
    if (!this.orderId || this._busy()) return;
    this._busy.set(true);
    this._errorKey.set(null);
    try {
      const started = await this.gateways.for('online').start(this.orderId);
      if (started.kind === 'failed') this._errorKey.set(started.errorKey);
      await this.load(this.orderId);
    } finally {
      this._busy.set(false);
    }
  }
}
