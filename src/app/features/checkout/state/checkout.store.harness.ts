import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { BusinessRepository } from '@shared/business/data/business.repository';
import type { BusinessHours } from '@shared/business/models/business.model';
import { CartStore } from '@shared/cart/cart.store';
import { OrderRepository } from '@shared/orders/order.repository';
import { SessionProfileStore } from '@shared/account/session-profile.store';
import { PaymentGatewayFactory } from '@shared/payments/payment-gateway';
import { PaymentRepository } from '@shared/payments/payment.repository';
import { CheckoutStore } from './checkout.store';
import { PickupScheduleStore } from './pickup-schedule.store';
import { useFixedClock } from '../../../../testing/fixed-clock';


/** What the CheckoutStore specs share: the mocks, the store and a cart with two Capuchinos. */
export function checkoutHarness() {
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
  const payments = {
    labelKey: 'checkout.payment.payAtPickup',
    start: vi.fn().mockResolvedValue({ kind: 'pay_at_pickup' }),
  };
  const online = { labelKey: 'checkout.payment.online', start: vi.fn().mockResolvedValue({ kind: 'redirected', leftPage: false }) };
  const gateways = { for: vi.fn((method: string) => (method === 'online' ? online : payments)) };
  const config = { config: vi.fn().mockResolvedValue({ enabled: false, sandbox: false }) };

  const h = {
    orders,
    week,
    businesses,
    session,
    payments,
    online,
    gateways,
    config,
    store: null as unknown as CheckoutStore,
    schedule: null as unknown as PickupScheduleStore,
    cart: null as unknown as CartStore,
    navigate: null as unknown as ReturnType<typeof vi.spyOn>,
  };

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
    h.cart = TestBed.inject(CartStore);
    TestBed.tick();
    h.cart.add({
      menuItemId: 'm1',
      businessId: 'b1',
      businessName: 'Café',
      name: 'Capuchino',
      priceCop: 6500,
    });
    h.cart.add({
      menuItemId: 'm1',
      businessId: 'b1',
      businessName: 'Café',
      name: 'Capuchino',
      priceCop: 6500,
    });
    h.store = TestBed.inject(CheckoutStore);
    h.schedule = TestBed.inject(PickupScheduleStore);
    TestBed.tick();
    await Promise.resolve();
    h.navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });
  return h;
}
