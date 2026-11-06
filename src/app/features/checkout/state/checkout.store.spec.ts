import { TestBed } from '@angular/core/testing';
import { Residence } from '@shared/geo/residence';
import { CheckoutStore } from './checkout.store';
import { describe, expect, it, vi } from 'vitest';
import { checkoutHarness } from './checkout.store.harness';

describe('CheckoutStore: orders', () => {
  const h = checkoutHarness();
  const { orders, session, payments } = h;

  it('sends only ids and quantities, empties the h.cart and opens the order', async () => {
    orders.create.mockResolvedValue({ data: 'o1', errorKey: null });
    h.store.notes.set('  Sin azúcar  ');

    await h.store.confirm();

    expect(orders.create).toHaveBeenCalledWith({
      businessId: 'b1',
      items: [{ menuItemId: 'm1', quantity: 2 }],
      pickupAt: null,
      notes: 'Sin azúcar',
      paymentMethod: 'pay_at_pickup',
    });
    expect(h.cart.isEmpty()).toBe(true);
    expect(payments.start).toHaveBeenCalledWith('o1');
    expect(h.navigate.mock.calls.at(-1)?.[1]).toEqual({ state: { arrival: 'placed' } });
    expect(h.navigate.mock.calls.at(-1)?.[0]).toEqual(['/orders', 'o1']);
  });

  it('keeps the h.cart and shows the server rule that failed', async () => {
    orders.create.mockResolvedValue({ data: null, errorKey: 'orders.errors.tooManyPending' });

    await h.store.confirm();

    expect(h.store.errorKey()).toBe('orders.errors.tooManyPending');
    expect(h.cart.units()).toBe(2);
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.store.submitting()).toBe(false);
  });

  it('validates the pick-up time and notes before calling the server', async () => {
    h.schedule.option.set('later');
    h.schedule.time.set('');
    await h.store.confirm();
    expect(h.store.errorKey()).toBe('checkout.errors.outsideHours');

    h.schedule.option.set('now');
    h.store.notes.set('x'.repeat(201));
    await h.store.confirm();
    expect(h.store.errorKey()).toBe('orders.errors.invalidNotes');
    expect(orders.create).not.toHaveBeenCalled();
  });

  it('schedules "Mañana" with an ISO time', async () => {
    orders.create.mockResolvedValue({ data: 'o2', errorKey: null });
    h.schedule.option.set('tomorrow');
    h.schedule.time.set('08:30');

    await h.store.confirm();

    const { pickupAt } = orders.create.mock.calls[0]?.[0] as { pickupAt: string };
    const at = new Date(pickupAt);
    expect([at.getDate(), at.getHours(), at.getMinutes()]).toEqual([15, 8, 30]);
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
