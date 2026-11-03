import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { BusinessRepository } from '@shared/business/data/business.repository';
import type { BusinessHours } from '@shared/business/models/business.model';
import { CartStore } from '@shared/cart/cart.store';
import { OrderRepository } from '@shared/orders/order.repository';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { Residence } from '@shared/geo/residence';
import { PaymentGatewayFactory } from '@shared/payments/payment-gateway';
import { PaymentRepository } from '@shared/payments/payment.repository';
import { CheckoutStore } from './checkout.store';
import { PickupScheduleStore } from './pickup-schedule.store';
import { useFixedClock } from '../../../../testing/fixed-clock';

describe('CheckoutStore', () => {
  useFixedClock();

  const orders = { create: vi.fn(), list: vi.fn() };
  // Open every day 08:00-22:00; the fixed clock is Wednesday at noon.
  const week = Array.from({ length: 7 }, (_, day) => ({
    day_of_week: day,
    opens_at: '08:00:00',
    closes_at: '22:00:00',
    is_closed: false,
  })) as BusinessHours[];
  const businesses = { getHours: vi.fn(), getById: vi.fn() };
  const session = { whenLoaded: vi.fn().mockResolvedValue(undefined), profile: vi.fn().mockReturnValue(null) };
  let store: CheckoutStore;
  let schedule: PickupScheduleStore;
  let cart: CartStore;
  let navigate: ReturnType<typeof vi.spyOn>;
  const payments = {
    labelKey: 'checkout.payment.payAtPickup',
    start: vi.fn().mockResolvedValue({ kind: 'pay_at_pickup' }),
  };
  const online = { labelKey: 'checkout.payment.online', start: vi.fn().mockResolvedValue({ kind: 'redirected' }) };
  const gateways = { for: vi.fn((method: string) => (method === 'online' ? online : payments)) };
  const config = { config: vi.fn().mockResolvedValue({ enabled: false, sandbox: false }) };

  beforeEach(async () => {
    localStorage.clear();
    vi.clearAllMocks();
    businesses.getHours.mockResolvedValue({ data: week, errorKey: null });
    businesses.getById.mockResolvedValue({ data: { city_dane_code: '52001' }, errorKey: null });
    session.whenLoaded.mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        CheckoutStore,
        PickupScheduleStore,
        provideRouter([]),
        { provide: BusinessRepository, useValue: businesses },
        { provide: AuthService, useValue: { user: signal({ id: 'u1' }) } },
        { provide: OrderRepository, useValue: orders },
        { provide: SessionProfileStore, useValue: session },
        { provide: PaymentGatewayFactory, useValue: gateways },
        { provide: PaymentRepository, useValue: config },
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

  it('a business still in review (shown with show_pending_businesses) takes pick-up payment only', async () => {
    config.config.mockResolvedValue({ enabled: true, sandbox: true });
    businesses.getById.mockResolvedValue({ data: { city_dane_code: '52001', verification_status: 'pending' }, errorKey: null });
    const inReview = TestBed.runInInjectionContext(() => new CheckoutStore());
    inReview.method.set('online');
    await vi.waitFor(() => expect(inReview.inReview()).toBe(true));
    expect([inReview.onlineAvailable(), inReview.method()]).toEqual([false, 'pay_at_pickup']);

    businesses.getById.mockResolvedValue({ data: { city_dane_code: '52001', verification_status: 'approved' }, errorKey: null });
    const approved = TestBed.runInInjectionContext(() => new CheckoutStore());
    await vi.waitFor(() => expect(approved.onlineAvailable()).toBe(true));
    config.config.mockResolvedValue({ enabled: false, sandbox: false });
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
      paymentMethod: 'pay_at_pickup',
    });
    expect(cart.isEmpty()).toBe(true);
    expect(payments.start).toHaveBeenCalledWith('o1');
    expect(navigate).toHaveBeenCalledWith(['/orders', 'o1']);
  });

  it('trust limit: never mentions paying online when payments are off, and links to the order to pick up', async () => {
    orders.create.mockResolvedValue({ data: null, errorKey: 'orders.errors.trustPendingLimit' });
    orders.list.mockResolvedValue({
      data: [
        { id: 'paid', payment_method: 'online', status: 'pending' },
        { id: 'done', payment_method: 'pay_at_pickup', status: 'picked_up' },
        { id: 'open', payment_method: 'pay_at_pickup', status: 'accepted' },
      ],
      errorKey: null,
    });

    await store.confirm();

    expect(store.errorKey()).toBe('orders.errors.trustPendingLimit');
    expect(store.blockingOrderId()).toBe('open');
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

  it('offers online payment only when the server enables it, and then pays online', async () => {
    orders.create.mockResolvedValue({ data: 'o3', errorKey: null });
    store.method.set('online');
    await store.confirm();
    expect(orders.create.mock.calls[0][0].paymentMethod).toBe('pay_at_pickup');
    expect(store.onlineAvailable()).toBe(false);
  });

  it('online orders open the Wompi checkout, then the order', async () => {
    config.config.mockResolvedValue({ enabled: true, sandbox: true });
    const fresh = TestBed.runInInjectionContext(() => new CheckoutStore());
    await Promise.resolve();
    await Promise.resolve();
    expect([fresh.onlineAvailable(), fresh.sandbox()]).toEqual([true, true]);
    orders.create.mockResolvedValue({ data: 'o4', errorKey: null });
    fresh.method.set('online');
    await fresh.confirm();
    expect(orders.create.mock.calls[0][0].paymentMethod).toBe('online');
    expect(online.start).toHaveBeenCalledWith('o4');
    expect(navigate).toHaveBeenCalledWith(['/orders', 'o4']);
  });

  it('trust limit with payments on: offers paying this order online', async () => {
    config.config.mockResolvedValue({ enabled: true, sandbox: false });
    const fresh = TestBed.runInInjectionContext(() => new CheckoutStore());
    await vi.waitFor(() => expect(fresh.onlineAvailable()).toBe(true));
    orders.create.mockResolvedValue({ data: null, errorKey: 'orders.errors.trustPendingLimit' });
    orders.list.mockResolvedValue({ data: [], errorKey: null });

    await fresh.confirm();

    expect(fresh.errorKey()).toBe('orders.errors.trustPendingLimitOnline');
    expect(fresh.blockingOrderId()).toBeNull();
  });

  it('tells the customer when the business is in another department', async () => {
    session.profile.mockReturnValue({ residence: Residence.of('Valle del Cauca', 'Cali', '76001') });
    const fresh = TestBed.runInInjectionContext(() => new CheckoutStore());
    await vi.waitFor(() => expect(fresh.otherDepartment()).toBe(true));
    session.profile.mockReturnValue({ residence: Residence.of('Nariño', 'Pasto', '52001') });
    const local = TestBed.runInInjectionContext(() => new CheckoutStore());
    await new Promise((resolve) => setTimeout(resolve));
    expect(local.otherDepartment()).toBe(false);
  });
});
