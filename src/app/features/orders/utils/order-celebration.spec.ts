import { describe, expect, it } from 'vitest';
import { OrderCelebration } from './order-celebration';

describe('OrderCelebration', () => {
  it('reads only the known arrivals from the router state', () => {
    expect(OrderCelebration.arrivalOf({ arrival: 'placed' })).toBe('placed');
    expect(OrderCelebration.arrivalOf({ arrival: 'paid' })).toBe('paid');
    expect(OrderCelebration.arrivalOf({ arrival: 'other' })).toBeNull();
    expect(OrderCelebration.arrivalOf(undefined)).toBeNull();
  });

  it.each([
    ['just placed', 'placed', null, false, true],
    ['back from a payment the server approved', 'paid', null, true, true],
    ['back from a payment not approved', 'paid', null, false, false],
    ['approved while the screen is open', null, false, true, true],
    ['an old paid order, opened', null, null, true, false],
    ['already paid, read again', null, true, true, false],
    ['still not paid', null, false, false, false],
  ] as const)('%s', (...[, arrival, wasPaid, isPaid, expected]) => {
    expect(OrderCelebration.plays(arrival, wasPaid, isPaid)).toBe(expected);
  });
});
