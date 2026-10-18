import { describe, expect, it } from 'vitest';
import { mapOrderError } from './order-error';

describe('mapOrderError', () => {
  it('maps the server codes, including the opening-hours check', () => {
    expect(mapOrderError('business_closed', 'x')).toBe('orders.errors.businessClosed');
    expect(mapOrderError(' too_many_pending ', 'x')).toBe('orders.errors.tooManyPending');
  });

  it('never shows an unknown database message', () => {
    expect(
      mapOrderError('relation "orders" violates something', 'orders.errors.createFailed'),
    ).toBe('orders.errors.createFailed');
    expect(mapOrderError(undefined, 'fallback')).toBe('fallback');
  });
});
