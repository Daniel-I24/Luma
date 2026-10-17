import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderRepository } from '@shared/orders/order.repository';
import { ORDER_REFRESH_MS, OrderDetailPage } from './order-detail.page';
import { OrdersPage } from './orders.page';

const business = { id: 'b1', name: 'Fritanga Don Segundo', address: 'Calle 19', latitude: 1.21, longitude: -77.28 };
const order = (status: string) => ({
  id: 'o1',
  status,
  pickup_at: null,
  total_cop: 14000,
  notes: null,
  created_at: '2026-10-17T12:00:00.000Z',
  business,
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
          langs: { es: { orders: { detail: { cancel: 'Cancelar pedido' } } } },
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
    expect(link.textContent?.replace(/\s/g, ' ')).toContain('$ 14.000');
  });

  async function renderDetail(status: string) {
    repo.getById.mockResolvedValue({ data: order(status), errorKey: null });
    const fixture = TestBed.createComponent(OrderDetailPage);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const cancelButton = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Cancelar pedido'));

  it('shows directions with the business coordinates and allows cancelling while pending', async () => {
    const el = await renderDetail('pending');

    expect(el.querySelector('a[href*="destination=1.21%2C-77.28"]')).not.toBeNull();
    expect(el.querySelector('app-order-timeline [aria-current="step"]')).not.toBeNull();
    expect(cancelButton(el)).toBeDefined();
  });

  it('hides "Cancelar" once the order left pending', async () => {
    expect(cancelButton(await renderDetail('accepted'))).toBeUndefined();
  });

  it(`refreshes every ${ORDER_REFRESH_MS / 1000} s while visible`, async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await renderDetail('preparing');
    repo.getById.mockClear();

    vi.advanceTimersByTime(ORDER_REFRESH_MS * 2);

    expect(repo.getById).toHaveBeenCalledTimes(2);
    expect(repo.getById).toHaveBeenCalledWith('o1');
  });
});
