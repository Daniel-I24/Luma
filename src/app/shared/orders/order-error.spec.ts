import { describe, expect, it } from 'vitest';
import { OrderErrors } from './order-error';

describe('mapOrderError', () => {
  it('maps the server codes, including the opening-hours check', () => {
    expect(OrderErrors.mapOrderError('business_closed', 'x')).toBe('orders.errors.businessClosed');
    expect(OrderErrors.mapOrderError(' too_many_pending ', 'x')).toBe('orders.errors.tooManyPending');
    expect(OrderErrors.mapOrderError('own_business', 'x')).toBe('orders.errors.ownBusiness');
  });

  it('never shows an unknown database message', () => {
    expect(
      OrderErrors.mapOrderError('relation "orders" violates something', 'orders.errors.createFailed'),
    ).toBe('orders.errors.createFailed');
    expect(OrderErrors.mapOrderError(undefined, 'fallback')).toBe('fallback');
  });
});
