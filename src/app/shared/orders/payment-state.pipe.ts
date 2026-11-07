import { Pipe, type PipeTransform } from '@angular/core';
import { OrderPaymentState, type PaymentFacts, type PaymentState } from './order-payment-state';

/** `order | paymentState` — the order's own payment line (OrderPaymentState), for its translation key. */
@Pipe({ name: 'paymentState', standalone: true })
export class PaymentStatePipe implements PipeTransform {
  /** The payment state of the order. */
  public transform(order: PaymentFacts): PaymentState {
    return OrderPaymentState.of(order);
  }
}
