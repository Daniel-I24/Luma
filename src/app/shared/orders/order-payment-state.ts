/** What an order's money looks like, the same in every view (customer and business). */
export type PaymentState = 'at_pickup' | 'paid' | 'unpaid' | 'expired' | 'refunding' | 'refunded' | 'voided';
export type PaymentTone = 'success' | 'warning' | 'neutral';

/** The two columns every order carries; the label comes only from them. */
export interface PaymentFacts {
  readonly payment_method: 'pay_at_pickup' | 'online';
  readonly payment_status: string;
}

const ONLINE: Readonly<Record<string, PaymentState>> = {
  approved: 'paid',
  refund_required: 'refunding',
  refunded: 'refunded',
  voided: 'voided',
  expired: 'expired',
};

const TONE: Readonly<Record<PaymentState, PaymentTone>> = {
  at_pickup: 'neutral',
  paid: 'success',
  unpaid: 'warning',
  expired: 'neutral',
  refunding: 'warning',
  refunded: 'neutral',
  voided: 'neutral',
};

/** OrderPaymentState — the payment line of an order, read from the order itself. */
export class OrderPaymentState {
  /** The payment line of this order: its method first, then what happened to the payment. */
  public static of(order: PaymentFacts): PaymentState {
    if (order.payment_method === 'pay_at_pickup') return 'at_pickup';
    return ONLINE[order.payment_status] ?? 'unpaid';
  }

  /** How the line is coloured: paid is good news, waiting money is a warning. */
  public static tone(state: PaymentState): PaymentTone {
    return TONE[state];
  }
}
