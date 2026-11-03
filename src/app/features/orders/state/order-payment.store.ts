import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { PaymentGatewayFactory } from '@shared/payments/payment-gateway';
import { type OrderPayment, PaymentRepository } from '@shared/payments/payment.repository';

const SECOND_MS = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_DIGITS = 2;

/**
 * OrderPaymentStore — the online payment of one order as the server has it
 * (my_order_payment): status, attempts left and when the unpaid order
 * expires; "Reintentar pago" opens a new Wompi checkout. When it cannot be
 * used, blockedKey says why (already paid, no attempts left, expired, or an
 * attempt still in progress with the time left). Never decides that an order
 * is paid: only the server does, after Wompi confirms it.
 */
@Injectable()
export class OrderPaymentStore {
  private readonly payments = inject(PaymentRepository);
  private readonly gateways = inject(PaymentGatewayFactory);

  private readonly _payment = signal<OrderPayment | null>(null);
  private readonly _busy = signal(false);
  private readonly _errorKey = signal<string | null>(null);
  private readonly _retryAt = signal<number | null>(null);
  private readonly _now = signal(Date.now());
  private orderId: string | null = null;
  private clock: ReturnType<typeof setInterval> | null = null;

  public readonly payment = this._payment.asReadonly();
  public readonly busy = this._busy.asReadonly();
  public readonly errorKey = this._errorKey.asReadonly();
  public readonly attemptsLeft = computed(() => {
    const payment = this._payment();
    return payment ? Math.max(payment.attemptsMax - payment.attemptsUsed, 0) : 0;
  });
  /** Seconds until a new attempt is allowed (attempt_in_progress), 0 when it is. */
  public readonly waitSeconds = computed(() => {
    const at = this._retryAt();
    return at === null ? 0 : Math.max(Math.ceil((at - this._now()) / SECOND_MS), 0);
  });
  /** The time left as m:ss, for payments.errors.attemptInProgress. */
  public readonly waitLabel = computed(() => {
    const seconds = this.waitSeconds();
    return `${Math.floor(seconds / SECONDS_PER_MINUTE)}:${String(seconds % SECONDS_PER_MINUTE).padStart(SECONDS_DIGITS, '0')}`;
  });
  /** Why "Reintentar pago" is disabled, or null when it can be used. */
  public readonly blockedKey = computed<string | null>(() => {
    const payment = this._payment();
    if (!payment) return null;
    if (payment.status === 'approved') return 'payments.errors.alreadyPaid';
    if (this.attemptsLeft() === 0) return 'payments.errors.tooManyAttempts';
    if (payment.expiresAt && Date.parse(payment.expiresAt) <= this._now()) return 'payments.errors.expired';
    return this.waitSeconds() > 0 ? 'payments.errors.attemptInProgress' : null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopClock());
  }

  /** Loads the payment attempts of an order. */
  public async load(orderId: string): Promise<void> {
    this.orderId = orderId;
    const result = await this.payments.orderPayment(orderId);
    this._now.set(Date.now());
    if (result.data) this._payment.set(result.data);
  }

  /** True while the waiting time for the payment has not run out. */
  public canStillPay(now = Date.now()): boolean {
    const expires = this._payment()?.expiresAt;
    return this.attemptsLeft() > 0 && (!expires || Date.parse(expires) > now);
  }

  /** Opens a new checkout attempt; the order screen re-reads the server on return. */
  public async pay(): Promise<void> {
    if (!this.orderId || this._busy() || this.blockedKey()) return;
    this._busy.set(true);
    this._errorKey.set(null);
    try {
      const started = await this.gateways.for('online').start(this.orderId);
      if (started.kind === 'failed' && started.retryAfterSeconds) this.waitFor(started.retryAfterSeconds);
      await this.load(this.orderId);
      // A cause already shown next to the disabled button is not repeated as an error.
      if (started.kind === 'failed' && started.errorKey !== this.blockedKey()) this._errorKey.set(started.errorKey);
    } finally {
      this._busy.set(false);
    }
  }

  private waitFor(seconds: number): void {
    this._now.set(Date.now());
    this._retryAt.set(Date.now() + seconds * SECOND_MS);
    this.stopClock();
    this.clock = setInterval(() => {
      this._now.set(Date.now());
      if (this.waitSeconds() === 0) this.stopClock();
    }, SECOND_MS);
  }

  private stopClock(): void {
    if (this.clock !== null) clearInterval(this.clock);
    this.clock = null;
  }
}
