import { InjectionToken } from '@angular/core';

/**
 * What happens after an order is created. Today only "pay at pick-up"; the
 * Wompi hosted checkout (docs/payments.md) will add its own outcome here,
 * with amounts always taken from the server.
 */
export interface PaymentStart {
  readonly kind: 'pay_at_pickup';
}

/** How an order is paid. The app never handles card data. */
export interface PaymentGateway {
  /** Translation key of the method shown at checkout. */
  readonly labelKey: string;
  start(orderId: string): Promise<PaymentStart>;
}

/** The customer pays in the store when picking the order up. */
export class PayAtPickupGateway implements PaymentGateway {
  readonly labelKey = 'checkout.payment.payAtPickup';

  start(): Promise<PaymentStart> {
    return Promise.resolve({ kind: 'pay_at_pickup' });
  }
}

export const PAYMENT_GATEWAY = new InjectionToken<PaymentGateway>('PAYMENT_GATEWAY', {
  providedIn: 'root',
  factory: () => new PayAtPickupGateway(),
});
