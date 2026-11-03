import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderRepository } from '@shared/orders/order.repository';
import { FakeRealtimeService } from '../../../testing/fake-realtime';
import { OrderDetailPage } from './order-detail.page';
import { OrdersPage } from './orders.page';

const business = { id: 'b1', latitude: 1.21, longitude: -77.28 };
const order = (status: string, deleted = false) => ({
  id: 'o1',
  business_id: deleted ? null : 'b1',
  business_name: 'Fritanga Don Segundo',
  business_address: 'Calle 19',
  status,
  pickup_at: null,
  total_cop: 14000,
  notes: null,
  created_at: '2026-10-17T12:00:00.000Z',
  business: deleted ? null : business,
  items: [{ id: 'i1', menu_item_id: 'm1', name: 'Fritanga', unit_price_cop: 7000, quantity: 2 }],
});
const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('Orders pages', () => {
  const repo = { list: vi.fn(), getById: vi.fn(), cancel: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {
            es: {
              orders: {
                unknownBusiness: 'Negocio no disponible',
                detail: { cancel: 'Cancelar pedido' },
              },
            },
          },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: OrderRepository, useValue: repo },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'o1' })) } },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('lists the orders with business, status and total, linking to each', async () => {
    repo.list.mockResolvedValue({ data: [order('preparing')], errorKey: null });
    const fixture = TestBed.createComponent(OrdersPage);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    const link = (fixture.nativeElement as HTMLElement).querySelector('a')!;

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

  async function renderDetail(status: string, deleted = false) {
    repo.getById.mockResolvedValue({ data: order(status, deleted), errorKey: null });
    const fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const cancelButton = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cancelar pedido'),
    );

  it('shows directions with the business coordinates and allows cancelling while pending', async () => {
    const el = await renderDetail('pending');

    expect(el.querySelector('a[href*="destination=1.21%2C-77.28"]')).not.toBeNull();
    expect(el.querySelector('app-order-timeline [aria-current="step"]')).not.toBeNull();
    expect(cancelButton(el)).toBeDefined();
  });

  it('keeps the copied name and address once the business is deleted, without directions', async () => {
    const el = await renderDetail('picked_up', true);

    expect(el.textContent).toContain('Fritanga Don Segundo');
    expect(el.textContent).toContain('Negocio no disponible');
    expect(el.textContent).toContain('Calle 19');
    expect(el.querySelector('a[href*="destination="]')).toBeNull();
  });

  it('marks deleted businesses in the list', async () => {
    repo.list.mockResolvedValue({
      data: [order('picked_up', true), { ...order('pending'), id: 'o2' }],
      errorKey: null,
    });
    const fixture = TestBed.createComponent(OrdersPage);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    const links = (fixture.nativeElement as HTMLElement).querySelectorAll('a');

    expect(links[0].textContent).toContain('Negocio no disponible');
    expect(links[1].textContent).not.toContain('Negocio no disponible');
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
