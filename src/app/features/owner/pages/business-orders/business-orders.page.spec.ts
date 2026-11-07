import { TestBed } from '@angular/core/testing';
import { FakeRealtimeService } from '../../../../../testing/fake-realtime';
import { describe, expect, it } from 'vitest';
import { businessOrdersPageHarness, order } from './business-orders.page.harness';

describe('BusinessOrdersPage', () => {
  const h = businessOrdersPageHarness();
  const { repo, render } = h;

  it('shows new orders first, with counts in the tabs and the label never an id', async () => {
    const { el } = await render();

    expect(el.querySelectorAll('[role="tab"]')).toHaveLength(4);
    expect(el.querySelectorAll('app-owner-order-card')).toHaveLength(1);
    expect(el.querySelector('app-owner-order-card h3')?.textContent).toContain('Ana P.');
  });

  it('shows the customer notes as text, never as HTML', async () => {
    const { el } = await render();

    const card = el.querySelector('app-owner-order-card')!;
    expect(card.querySelector('img')).toBeNull();
    expect(card.textContent).toContain('<img src=x onerror=alert(1)> sin cebolla');
  });

  it('shows "Pagado en línea" for orders paid online, and never "al recoger"', async () => {
    repo.list.mockResolvedValue({ data: [order('o5', 'pending', { payment_method: 'online', payment_status: 'approved' })], errorKey: null });
    const { el } = await render();
    expect(el.textContent).toContain('businessOrders.paidOnline');
    expect(el.textContent).not.toContain('businessOrders.payAtPickup');
  });

  it('an order to pay at pick-up says so on the card', async () => {
    const { el } = await render();
    expect(el.querySelector('[data-test="payment-line"]')?.textContent?.trim()).toBe('businessOrders.payAtPickup');
  });

  it('lists the other tabs with their next action', async () => {
    const { fixture, el } = await render();

    el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1]?.click();
    fixture.detectChanges();

    expect(el.querySelector('app-owner-order-card')?.textContent).toContain(
      'businessOrders.actions.ready',
    );
  });

  it('a new order of this business arrives without refreshing; orders of other businesses do not reload it', async () => {
    await render();
    repo.list.mockClear();
    const realtime = TestBed.inject(FakeRealtimeService);

    await realtime.emit('order_events', [{ order_id: 'x', business_id: 'other' }]);
    expect(repo.list).not.toHaveBeenCalled();
    await realtime.emit('order_events', [{ order_id: 'o9', business_id: 'b1' }]);
    expect(repo.list).toHaveBeenCalledTimes(1);
  });
});
