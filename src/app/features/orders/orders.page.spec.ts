import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeRealtimeService } from '../../../testing/fake-realtime';
import { OrdersPage } from './orders.page';
import { OrdersTesting } from './orders.harness';

const { repo, order, flush } = OrdersTesting;

describe('OrdersPage', () => {
  beforeEach(() => OrdersTesting.configure());
  afterEach(() => vi.useRealTimers());

  async function renderList(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(OrdersPage);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists the orders with business, status and total, linking to each', async () => {
    repo.list.mockResolvedValue({ data: [order('preparing')], errorKey: null });
    const link = (await renderList()).querySelector('a')!;

    expect(link.getAttribute('href')).toBe('/orders/o1');
    expect(link.textContent).toContain('Fritanga Don Segundo');
    expect(link.querySelector('app-order-status-badge')).not.toBeNull();
    expect(link.textContent?.replace(/\s/g, ' ')).toContain('$14.000');
  });

  it('a new status arrives in the list without a skeleton, and "Actualizado hace" is shown', async () => {
    repo.list.mockResolvedValue({ data: [order('preparing')], errorKey: null });
    const fixture = TestBed.createComponent(OrdersPage);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('realtime.updatedNow');
    repo.list.mockResolvedValue({ data: [order('ready')], errorKey: null });

    await TestBed.inject(FakeRealtimeService).emit('order_events', [{ order_id: 'o1', user_id: 'u1' }]);
    fixture.detectChanges();

    expect(repo.list).toHaveBeenCalledTimes(2);
    expect(el.querySelector('[aria-busy="true"]')).toBeNull();
    expect(el.querySelector('a')).not.toBeNull();
  });

  it('marks deleted businesses in the list', async () => {
    repo.list.mockResolvedValue({
      data: [order('picked_up', true), { ...order('pending'), id: 'o2' }],
      errorKey: null,
    });
    const links = (await renderList()).querySelectorAll('a');

    expect(links[0]?.textContent).toContain('Negocio no disponible');
    expect(links[1]?.textContent).not.toContain('Negocio no disponible');
  });
});
