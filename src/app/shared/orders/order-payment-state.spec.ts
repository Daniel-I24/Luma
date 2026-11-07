import { describe, expect, it } from 'vitest';
import { OrderPaymentState } from './order-payment-state';

describe('OrderPaymentState', () => {
  it('pay at pick-up stays at pick-up whatever the payment status', () => {
    expect(OrderPaymentState.of({ payment_method: 'pay_at_pickup', payment_status: 'none' })).toBe(
      'at_pickup',
    );
  });

  it('an approved online payment is paid, never "pay at pick-up"', () => {
    expect(OrderPaymentState.of({ payment_method: 'online', payment_status: 'approved' })).toBe(
      'paid',
    );
    expect(OrderPaymentState.tone('paid')).toBe('success');
  });

  it('refunds and voids follow the payment; anything else online is still unpaid', () => {
    expect(
      OrderPaymentState.of({ payment_method: 'online', payment_status: 'refund_required' }),
    ).toBe('refunding');
    expect(OrderPaymentState.of({ payment_method: 'online', payment_status: 'refunded' })).toBe(
      'refunded',
    );
    expect(OrderPaymentState.of({ payment_method: 'online', payment_status: 'voided' })).toBe(
      'voided',
    );
    expect(OrderPaymentState.of({ payment_method: 'online', payment_status: 'pending' })).toBe(
      'unpaid',
    );
    expect(OrderPaymentState.of({ payment_method: 'online', payment_status: 'declined' })).toBe(
      'unpaid',
    );
    expect(OrderPaymentState.of({ payment_method: 'online', payment_status: 'expired' })).toBe(
      'expired',
    );
  });
});
