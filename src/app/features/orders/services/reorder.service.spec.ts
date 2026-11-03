import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { CartStore } from '@shared/cart/cart.store';
import type { OrderWithItems } from '@shared/orders/order.model';
import { ReorderService } from './reorder.service';

const order = (overrides: Partial<OrderWithItems> = {}): OrderWithItems => ({
  id: 'o1', business_id: 'b1', business_name: 'Café Público', business_address: 'Calle 19', status: 'picked_up',
  pickup_at: null, total_cop: 14000, notes: null, payment_method: 'pay_at_pickup', payment_status: 'none',
  cancel_reason: null, created_at: '', updated_at: '', business: null,
  items: [
    { id: 'i1', menu_item_id: 'm1', name: 'Tinto', unit_price_cop: 2000, quantity: 4 },
    { id: 'i2', menu_item_id: null, name: 'Borrado del menú', unit_price_cop: 6000, quantity: 1 },
  ],
  ...overrides,
});

describe('ReorderService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { user: signal({ id: 'u1' }) } }] });
  });

  it('replaces the cart with the lines still on the menu, with their quantities', () => {
    const cart = TestBed.inject(CartStore);
    TestBed.tick();
    cart.add({ menuItemId: 'x', businessId: 'b2', businessName: 'Otro', name: 'Pan', priceCop: 1000 });
    expect(TestBed.inject(ReorderService).reorder(order())).toBe(true);
    expect(cart.items().map((i) => [i.menuItemId, i.quantity])).toEqual([['m1', 4]]);
    expect(cart.businessId()).toBe('b1');
  });

  it('cannot reorder when the business is gone or no item is left on the menu', () => {
    const reorder = TestBed.inject(ReorderService);
    expect(reorder.canReorder(order({ business_id: null }))).toBe(false);
    expect(reorder.reorder(order({ items: [order().items[1]] }))).toBe(false);
  });
});
