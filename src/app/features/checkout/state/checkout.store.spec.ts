import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { BusinessRepository } from '@shared/business/data/business.repository';
import type { BusinessHours } from '@shared/business/models/business.model';
import { CartStore } from '@shared/cart/cart.store';
import { OrderRepository } from '@shared/orders/order.repository';
import { PAYMENT_GATEWAY } from '@shared/payments/payment-gateway';
import { CheckoutStore } from './checkout.store';
import { PickupScheduleStore } from './pickup-schedule.store';
import { useFixedClock } from '../../../../testing/fixed-clock';

describe('CheckoutStore', () => {
  useFixedClock();

  const orders = { create: vi.fn() };
  // Open every day 08:00-22:00; the fixed clock is Wednesday at noon.
  const week = Array.from({ length: 7 }, (_, day) => ({
    day_of_week: day,
    opens_at: '08:00:00',
    closes_at: '22:00:00',
    is_closed: false,
  })) as BusinessHours[];
  const businesses = { getHours: vi.fn() };
  let store: CheckoutStore;
  let schedule: PickupScheduleStore;
  let cart: CartStore;
  let navigate: ReturnType<typeof vi.spyOn>;
  const payments = {
    labelKey: 'checkout.payment.payAtPickup',
    start: vi.fn().mockResolvedValue({ kind: 'pay_at_pickup' }),
  };

  beforeEach(async () => {
    localStorage.clear();
    vi.clearAllMocks();
    businesses.getHours.mockResolvedValue({ data: week, errorKey: null });
    TestBed.configureTestingModule({
      providers: [
        CheckoutStore,
        PickupScheduleStore,
        provideRouter([]),
        { provide: BusinessRepository, useValue: businesses },
        { provide: AuthService, useValue: { user: signal({ id: 'u1' }) } },
        { provide: OrderRepository, useValue: orders },
        { provide: PAYMENT_GATEWAY, useValue: payments },
      ],
    });
    cart = TestBed.inject(CartStore);
    TestBed.tick();
    cart.add({
      menuItemId: 'm1',
      businessId: 'b1',
      businessName: 'Café',
      name: 'Capuchino',
      priceCop: 6500,
    });
    cart.add({
      menuItemId: 'm1',
      businessId: 'b1',
      businessName: 'Café',
      name: 'Capuchino',
      priceCop: 6500,
    });
    store = TestBed.inject(CheckoutStore);
    schedule = TestBed.inject(PickupScheduleStore);
    TestBed.tick();
    await Promise.resolve();
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
    expect(payments.start).toHaveBeenCalledWith('o1');
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
    schedule.option.set('later');
    schedule.time.set('');
    await store.confirm();
    expect(store.errorKey()).toBe('checkout.errors.outsideHours');

    schedule.option.set('now');
    store.notes.set('x'.repeat(201));
    await store.confirm();
    expect(store.errorKey()).toBe('orders.errors.invalidNotes');
    expect(orders.create).not.toHaveBeenCalled();
  });

  it('schedules "Mañana" with an ISO time', async () => {
    orders.create.mockResolvedValue({ data: 'o2', errorKey: null });
    schedule.option.set('tomorrow');
    schedule.time.set('08:30');

    await store.confirm();

    const { pickupAt } = orders.create.mock.calls[0][0] as { pickupAt: string };
    const at = new Date(pickupAt);
    expect([at.getDate(), at.getHours(), at.getMinutes()]).toEqual([15, 8, 30]);
  });
});
