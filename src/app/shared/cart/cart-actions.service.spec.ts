import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { ToastService } from '@design-system/toast/toast.service';
import { CartActions } from './cart-actions.service';
import type { CartProduct } from './cart.model';
import { CartStore } from './cart.store';

const product = (id: string, businessId: string): CartProduct => ({
  menuItemId: id,
  businessId,
  businessName: businessId,
  name: id,
  priceCop: 1000,
});

describe('CartActions', () => {
  const toasts = { show: vi.fn() };
  let actions: CartActions;
  let cart: CartStore;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: signal({ id: 'u1' }) } },
        { provide: ToastService, useValue: toasts },
      ],
    });
    actions = TestBed.inject(CartActions);
    cart = TestBed.inject(CartStore);
    TestBed.tick();
  });

  it('asks before mixing businesses and replaces the cart only when confirmed', () => {
    actions.add(product('m1', 'b1'));
    actions.add(product('x1', 'b2'));
    expect(actions.pendingConflict()?.map((p) => p.menuItemId)).toEqual(['x1']);

    actions.cancelReplace();
    expect(actions.pendingConflict()).toBeNull();
    expect(cart.businessId()).toBe('b1');

    actions.add(product('x1', 'b2'));
    actions.confirmReplace();
    expect(cart.items().map((i) => i.menuItemId)).toEqual(['x1']);
  });

  it('explains the limits with a toast', () => {
    actions.add(product('m1', 'b1'));
    cart.setQuantity('m1', 20);

    actions.add(product('m1', 'b1'));

    expect(toasts.show).toHaveBeenCalledWith({ messageKey: 'cart.errors.limit', tone: 'error' });
  });

  it('adds a combo in one go, asking once when another business is in the cart', () => {
    actions.add(product('m1', 'b1'));
    actions.addAll([product('x1', 'b2'), product('x2', 'b2'), product('x3', 'b2')]);
    expect(actions.pendingConflict()).toHaveLength(3);

    actions.confirmReplace();

    expect(cart.items().map((i) => i.menuItemId)).toEqual(['x1', 'x2', 'x3']);
  });
});
