import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NativeHaptics } from '@core/native/native-haptics';
import { CartStore } from '@shared/cart/cart.store';
import { OrderRepository } from '@shared/orders/order.repository';
import { PaymentGatewayFactory, type PaymentMethod } from '@shared/payments/payment-gateway';
import { type PaymentConfig, PaymentRepository } from '@shared/payments/payment.repository';
import { PickupScheduleStore } from './pickup-schedule.store';

export const NOTES_MAX_LENGTH = 200;

/**
 * CheckoutStore — the order being confirmed: notes, the pick-up chosen in
 * PickupScheduleStore, how it is paid and the call to create_order. Only ids
 * and quantities leave the app; the server computes the total. "Pagar en
 * línea" appears only when payment_config says so; then the order is created
 * waiting for its payment and Wompi's checkout opens in the system browser.
 */
@Injectable()
export class CheckoutStore {
  private readonly cart = inject(CartStore);
  private readonly orders = inject(OrderRepository);
  private readonly router = inject(Router);
  private readonly schedule = inject(PickupScheduleStore);
  private readonly gateways = inject(PaymentGatewayFactory);
  private readonly payments = inject(PaymentRepository);
  private readonly haptics = inject(NativeHaptics);

  readonly notes = signal('');
  readonly method = signal<PaymentMethod>('pay_at_pickup');

  private readonly _config = signal<PaymentConfig>({ enabled: false, sandbox: false });
  private readonly _submitting = signal(false);
  private readonly _errorKey = signal<string | null>(null);
  readonly submitting = this._submitting.asReadonly();
  readonly errorKey = this._errorKey.asReadonly();
  readonly notesTooLong = computed(() => this.notes().length > NOTES_MAX_LENGTH);
  /** "Pagar en línea" is offered only when the server enables it. */
  readonly onlineAvailable = computed(() => this._config().enabled);
  /** Sandbox: "Modo de pruebas: no se cobra dinero real". */
  readonly sandbox = computed(() => this._config().enabled && this._config().sandbox);
  readonly paymentLabelKey = computed(() => this.gateways.for(this.method()).labelKey);

  constructor() {
    void this.payments.config().then((config) => {
      this._config.set(config);
      if (!config.enabled) this.method.set('pay_at_pickup');
    });
  }

  async confirm(): Promise<void> {
    if (this._submitting() || this.cart.isEmpty()) return;
    const pickup = this.schedule.choice();
    if (pickup.errorKey || this.notesTooLong()) {
      this._errorKey.set(pickup.errorKey ?? 'orders.errors.invalidNotes');
      return;
    }
    const businessId = this.cart.businessId();
    if (!businessId) return;

    this._errorKey.set(null);
    this._submitting.set(true);
    try {
      const method = this.onlineAvailable() ? this.method() : 'pay_at_pickup';
      const result = await this.orders.create({
        businessId,
        items: this.cart.items().map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
        pickupAt: pickup.pickupAt,
        notes: this.notes().trim() || null,
        paymentMethod: method,
      });
      if (!result.data) {
        this._errorKey.set(result.errorKey ?? 'orders.errors.createFailed');
        return;
      }
      this.cart.clear();
      void this.haptics.tap();
      // Online: the order screen shows the payment state and "Reintentar pago" if opening failed.
      await this.gateways.for(method).start(result.data);
      await this.router.navigate(['/orders', result.data]);
    } finally {
      this._submitting.set(false);
    }
  }
}
