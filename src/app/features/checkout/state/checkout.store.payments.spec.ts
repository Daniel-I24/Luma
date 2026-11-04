import { TestBed } from '@angular/core/testing';
import { CheckoutStore } from './checkout.store';
import { describe, expect, it, vi } from 'vitest';
import { checkoutHarness } from './checkout.store.harness';

describe('CheckoutStore: payments', () => {
  const h = checkoutHarness();
  const { orders, businesses, online, config } = h;

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

    await h.store.confirm();

    expect(h.store.errorKey()).toBe('orders.errors.trustPendingLimit');
    expect(h.store.blockingOrderId()).toBe('open');
  });

  it('offers online payment only when the server enables it, and then pays online', async () => {
    orders.create.mockResolvedValue({ data: 'o3', errorKey: null });
    h.store.method.set('online');
    await h.store.confirm();
    expect(orders.create.mock.calls[0]?.[0].paymentMethod).toBe('pay_at_pickup');
    expect(h.store.onlineAvailable()).toBe(false);
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
    expect(orders.create.mock.calls[0]?.[0].paymentMethod).toBe('online');
    expect(online.start).toHaveBeenCalledWith('o4');
    expect(h.navigate).toHaveBeenCalledWith(['/orders', 'o4']);
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
});
