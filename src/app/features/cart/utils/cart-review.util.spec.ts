import { describe, expect, it } from 'vitest';
import type { MenuItem } from '@shared/business/models/menu.model';
import type { CartItem } from '@shared/cart/cart.model';
import { reviewCart } from './cart-review.util';

const line = (id: string, priceCop: number): CartItem => ({
  menuItemId: id,
  businessId: 'b1',
  name: `Plato ${id}`,
  priceCop,
  quantity: 1,
});
const row = (id: string, price_cop: number, extra: Partial<MenuItem> = {}) =>
  ({ id, business_id: 'b1', price_cop, is_available: true, ...extra }) as MenuItem;

describe('reviewCart', () => {
  it('keeps unchanged lines silently', () => {
    const review = reviewCart([line('m1', 4000)], [row('m1', 4000)]);

    expect(review.notices).toEqual([]);
    expect(review.prices).toEqual(new Map([['m1', 4000]]));
  });

  it('reports price changes with both prices', () => {
    const review = reviewCart([line('m1', 4000)], [row('m1', 4500)]);

    expect(review.notices).toEqual([{ kind: 'price', name: 'Plato m1', before: 4000, after: 4500 }]);
    expect(review.prices.get('m1')).toBe(4500);
  });

  it('reports items missing, unavailable or moved to another business', () => {
    const review = reviewCart(
      [line('gone', 1), line('off', 1), line('moved', 1)],
      [row('off', 1, { is_available: false }), row('moved', 1, { business_id: 'b2' })],
    );

    expect(review.notices.map((n) => n.kind)).toEqual(['unavailable', 'unavailable', 'unavailable']);
    expect(review.prices.size).toBe(0);
  });
});
