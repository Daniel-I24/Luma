import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { CartStore } from '@shared/cart/cart.store';
import { OrderRepository } from '@shared/orders/order.repository';
import { CheckoutStore } from './checkout.store';

describe('CheckoutStore', () => {
  const orders = { create: vi.fn() };
  let store: CheckoutStore;
  let cart: CartStore;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        CheckoutStore,
        provideRouter([]),
        { provide: AuthService, useValue: { user: signal({ id: 'u1' }) } },
        { provide: OrderRepository, useValue: orders },
      ],
    });
    cart = TestBed.inject(CartStore);
    TestBed.tick();
    cart.add({ menuItemId: 'm1', businessId: 'b1', businessName: 'Café', name: 'Capuchino', priceCop: 6500 });
    cart.add({ menuItemId: 'm1', businessId: 'b1', businessName: 'Café', name: 'Capuchino', priceCop: 6500 });
    store = TestBed.inject(CheckoutStore);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  it('sends only ids and quantities, empties the cart and opens the order', async () => {
    orders.create.mockResolvedValue({ data: 'o1', errorKey: null });
    store.notes.set('  Sin azúcar  ');

    await store.confirm();

    expect(orders.create).toHaveBeenCalledWith({
      businessId: 'b1',
      items: [{ menuItemId: 'm1', quantity: 2 }],
      pickupAt: null,
      notes: 'Sin azúcar',
    });
    expect(cart.isEmpty()).toBe(true);
    expect(navigate).toHaveBeenCalledWith(['/orders', 'o1']);
  });

  it('keeps the cart and shows the server rule that failed', async () => {
    orders.create.mockResolvedValue({ data: null, errorKey: 'orders.errors.tooManyPending' });

    await store.confirm();

    expect(store.errorKey()).toBe('orders.errors.tooManyPending');
    expect(cart.units()).toBe(2);
    expect(navigate).not.toHaveBeenCalled();
    expect(store.submitting()).toBe(false);
  });

  it('validates the pick-up time and notes before calling the server', async () => {
    store.option.set('later');
    store.time.set('');
    await store.confirm();
    expect(store.errorKey()).toBe('checkout.errors.timeRequired');

    store.option.set('now');
    store.notes.set('x'.repeat(201));
    await store.confirm();
    expect(store.errorKey()).toBe('orders.errors.invalidNotes');
    expect(orders.create).not.toHaveBeenCalled();
  });

  it('schedules "Mañana" with an ISO time', async () => {
    orders.create.mockResolvedValue({ data: 'o2', errorKey: null });
    store.option.set('tomorrow');
    store.time.set('08:30');

    await store.confirm();

    const { pickupAt } = orders.create.mock.calls[0][0] as { pickupAt: string };
    const at = new Date(pickupAt);
    expect([at.getHours(), at.getMinutes()]).toEqual([8, 30]);
  });
});
