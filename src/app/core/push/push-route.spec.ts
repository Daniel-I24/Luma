import { describe, expect, it } from 'vitest';
import { PushRoute } from './push-route';

describe('PushRoute', () => {
  const of = (type: string | null, orderId: string | null = null, businessId: string | null = null) =>
    PushRoute.of({ type, orderId, businessId });

  it('customer order, payment and review-invite notices open the order', () => {
    expect(of('order_status', 'o1', 'b1')).toEqual(['/orders', 'o1']);
    expect(of('payment', 'o1')).toEqual(['/orders', 'o1']);
    expect(of('review_invite', 'o1', 'b1')).toEqual(['/orders', 'o1']);
  });

  it('owner notices open the panel of their business', () => {
    expect(of('order_new', 'o1', 'b1')).toEqual(['/owner', 'b1', 'orders']);
    expect(of('order_cancelled', 'o1', 'b1')).toEqual(['/owner', 'b1', 'orders']);
    expect(of('business_review', null, 'b1')).toEqual(['/owner', 'b1', 'summary']);
  });

  it('promotions open the business', () => {
    expect(of('promotion', null, 'b1')).toEqual(['/businesses', 'b1']);
  });

  it('a contact decision opens the owner contact screen; a new request, the admin queue', () => {
    expect(PushRoute.of({ type: 'contact_verification', orderId: null, businessId: 'b1', status: 'approved' }))
      .toEqual(['/owner', 'b1', 'business', 'contact']);
    expect(PushRoute.of({ type: 'contact_verification', orderId: null, businessId: 'b1', status: 'contact_requested' }))
      .toEqual(['/admin']);
  });

  it('unknown types or missing ids open the notification list', () => {
    expect(of(null)).toEqual(['/notifications']);
    expect(of('order_status')).toEqual(['/notifications']);
    expect(of('promotion')).toEqual(['/notifications']);
    expect(of('something_new', 'o1', 'b1')).toEqual(['/notifications']);
  });
});
