import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { UserDataRegistry } from '@core/auth/user-data-registry';
import { MAX_CART_UNITS, MAX_PER_ITEM, type CartProduct } from './cart.model';
import { CartStore } from './cart.store';

const product = (id: string, priceCop = 1000, businessId = 'b1'): CartProduct => ({
  menuItemId: id,
  businessId,
  businessName: businessId === 'b1' ? 'Café La Merced' : 'Otro',
  name: `Plato ${id}`,
  priceCop,
});

describe('CartStore', () => {
  const user = signal<{ id: string } | null>({ id: 'u1' });
  let cart: CartStore;

  function setup(): CartStore {
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { user } }] });
    const store = TestBed.inject(CartStore);
    TestBed.tick();
    return store;
  }

  beforeEach(() => {
    localStorage.clear();
    user.set({ id: 'u1' });
    cart = setup();
  });

  it('adds products, counts units and totals in whole pesos', () => {
    expect(cart.add(product('m1', 4000))).toBe('added');
    cart.add(product('m1', 4000));
    cart.add(product('m2', 6500));

    expect(cart.items()).toEqual([
      { menuItemId: 'm1', businessId: 'b1', name: 'Plato m1', priceCop: 4000, quantity: 2 },
      { menuItemId: 'm2', businessId: 'b1', name: 'Plato m2', priceCop: 6500, quantity: 1 },
    ]);
    expect(cart.units()).toBe(3);
    expect(cart.totalCop()).toBe(14500);
    expect(cart.businessName()).toBe('Café La Merced');
  });

  it('holds one business only: another business is a conflict until replaced', () => {
    cart.add(product('m1'));

    expect(cart.add(product('x1', 1000, 'b2'))).toBe('conflict');
    expect(cart.units()).toBe(1);

    expect(cart.replaceWith(product('x1', 1000, 'b2'))).toBe('added');
    expect(cart.items().map((i) => i.menuItemId)).toEqual(['x1']);
    expect(cart.businessId()).toBe('b2');
  });

  it(`caps a product at ${MAX_PER_ITEM} and the cart at ${MAX_CART_UNITS} units`, () => {
    cart.setQuantity('m1', 0);
    cart.add(product('m1'));
    cart.setQuantity('m1', 99);
    expect(cart.quantityOf('m1')).toBe(MAX_PER_ITEM);
    expect(cart.add(product('m1'))).toBe('limit');

    cart.add(product('m2'));
    cart.setQuantity('m2', 20);
    cart.add(product('m3'));
    cart.setQuantity('m3', 20);
    expect(cart.units()).toBe(MAX_CART_UNITS);
    expect(cart.add(product('m4'))).toBe('limit');
  });

  it('removes a line at quantity 0 and forgets the business when empty', () => {
    cart.add(product('m1'));
    cart.remove('m1');

    expect(cart.isEmpty()).toBe(true);
    expect(cart.businessName()).toBeNull();
  });

  it('persists per user and restores it for the same user only', () => {
    cart.add(product('m1'));
    user.set({ id: 'u2' });
    TestBed.tick();
    expect(cart.isEmpty()).toBe(true);

    user.set({ id: 'u1' });
    TestBed.tick();
    expect(cart.quantityOf('m1')).toBe(1);
  });

  it('is wiped (memory and storage) on sign-out or account deletion', () => {
    cart.add(product('m1'));

    TestBed.inject(UserDataRegistry).clearAll();

    expect(cart.isEmpty()).toBe(true);
    expect(localStorage.getItem('luma-cart:u1')).toBeNull();
  });

  it('ignores tampered or invalid stored carts', () => {
    localStorage.setItem('luma-cart:u3', JSON.stringify({ businessName: 'X', items: [{ menuItemId: 'm', quantity: 999 }] }));
    user.set({ id: 'u3' });
    TestBed.tick();

    expect(cart.isEmpty()).toBe(true);
  });

  it('reconciles with the server prices and drops lines no longer sold', () => {
    cart.add(product('m1', 4000));
    cart.add(product('m2', 6500));

    cart.reconcile(new Map([['m1', 4500]]));

    expect(cart.items()).toEqual([expect.objectContaining({ menuItemId: 'm1', priceCop: 4500 })]);
  });
});
