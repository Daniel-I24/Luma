import { type ComponentFixture, DeferBlockState, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeRealtimeService } from '../../../testing/fake-realtime';
import { OrderDetailPage } from './order-detail.page';
import { OrdersTesting } from './orders.harness';

const { repo, order, flush } = OrdersTesting;

describe('OrderDetailPage', () => {
  let detail: ComponentFixture<OrderDetailPage>;

  beforeEach(() => OrdersTesting.configure());
  afterEach(() => vi.useRealTimers());

  async function renderDetail(status: string, deleted = false): Promise<HTMLElement> {
    repo.getById.mockResolvedValue({ data: order(status, deleted), errorKey: null });
    detail = TestBed.createComponent(OrderDetailPage);
    detail.detectChanges();
    await flush();
    detail.detectChanges();
    return detail.nativeElement as HTMLElement;
  }

  const cancelButton = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cancelar pedido'),
    );

  it('allows cancelling while pending; the route appears only once the business accepts', async () => {
    const pending = await renderDetail('pending');
    expect(pending.querySelector('app-order-timeline [aria-current="step"]')).not.toBeNull();
    expect(cancelButton(pending)).toBeDefined();
    expect(pending.querySelector('app-route-map')).toBeNull();
    expect(await detail.getDeferBlocks()).toHaveLength(0);

    // The route map is deferred (on idle): first its placeholder, then the map with its directions link.
    const accepted = await renderDetail('accepted');
    const [routeBlock] = await detail.getDeferBlocks();
    await routeBlock!.render(DeferBlockState.Placeholder);
    expect(accepted.querySelector('app-route-map')).toBeNull();
    expect(accepted.querySelector('.bg-map-canvas[aria-hidden="true"]')).not.toBeNull();
    await routeBlock!.render(DeferBlockState.Complete);
    expect(accepted.querySelector('a[href*="destination=1.21%2C-77.28"]')).not.toBeNull();
  });

  it('keeps the copied name and address once the business is deleted, without directions', async () => {
    const el = await renderDetail('picked_up', true);

    expect(el.textContent).toContain('Fritanga Don Segundo');
    expect(el.textContent).toContain('Negocio no disponible');
    expect(el.textContent).toContain('Calle 19');
    expect(el.querySelector('a[href*="destination="]')).toBeNull();
  });

  it('hides "Cancelar" once the order left pending', async () => {
    expect(cancelButton(await renderDetail('accepted'))).toBeUndefined();
  });

  it('a status change of this order on the business phone refreshes it; other orders do not', async () => {
    await renderDetail('preparing');
    repo.getById.mockClear();
    const realtime = TestBed.inject(FakeRealtimeService);

    await realtime.emit('order_events', [{ order_id: 'another', user_id: 'u1' }]);
    expect(repo.getById).not.toHaveBeenCalled();
    await realtime.emit('order_events', [{ order_id: 'o1', user_id: 'u1' }]);
    expect(repo.getById).toHaveBeenCalledWith('o1');
  });
});
