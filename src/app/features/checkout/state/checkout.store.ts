import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NativeHaptics } from '@core/native/native-haptics';
import { CartStore } from '@shared/cart/cart.store';
import { OrderRepository } from '@shared/orders/order.repository';
import { PAYMENT_GATEWAY } from '@shared/payments/payment-gateway';
import { PickupScheduleStore } from './pickup-schedule.store';

export const NOTES_MAX_LENGTH = 200;

/**
 * CheckoutStore — the order being confirmed: notes, the pick-up chosen in
 * PickupScheduleStore and the call to create_order. Only ids and quantities leave the app; the server
 * computes the total. On success the cart is emptied and the order opens.
 */
@Injectable()
export class CheckoutStore {
  private readonly cart = inject(CartStore);
  private readonly orders = inject(OrderRepository);
  private readonly router = inject(Router);
  private readonly schedule = inject(PickupScheduleStore);
  private readonly payments = inject(PAYMENT_GATEWAY);
  private readonly haptics = inject(NativeHaptics);
  /** Translation key of the payment method shown at checkout. */
  readonly paymentLabelKey = this.payments.labelKey;

  readonly notes = signal('');

  private readonly _submitting = signal(false);
  private readonly _errorKey = signal<string | null>(null);
  readonly submitting = this._submitting.asReadonly();
  readonly errorKey = this._errorKey.asReadonly();
  readonly notesTooLong = computed(() => this.notes().length > NOTES_MAX_LENGTH);

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
      const result = await this.orders.create({
        businessId,
        items: this.cart
          .items()
          .map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
        pickupAt: pickup.pickupAt,
        notes: this.notes().trim() || null,
      });
      if (!result.data) {
        this._errorKey.set(result.errorKey ?? 'orders.errors.createFailed');
        return;
      }
      this.cart.clear();
      void this.haptics.tap();
      // Pay at pick-up: nothing to do online; the order screen says so.
      await this.payments.start(result.data);
      await this.router.navigate(['/orders', result.data]);
    } finally {
      this._submitting.set(false);
    }
  }
}
