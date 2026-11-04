import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, vi } from 'vitest';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import { BusinessOrderRepository } from '@shared/orders/business-order.repository';
import { BusinessOrdersPage } from './business-orders.page';

export const flush = () => new Promise((resolve) => setTimeout(resolve));
export const order = (id: string, status: string, extra: object = {}) => ({
  id,
  business_id: 'b1',
  status,
  pickup_at: null,
  total_cop: 12000,
  notes: null,
  created_at: `2026-10-14T12:0${id.length}:00Z`,
  updated_at: '',
  customer_label: null,
  payment_method: 'pay_at_pickup',
  payment_status: 'none',
  cancel_reason: null,
  ready_at: null,
  customer_avatar_path: null,
  items: [{ id: `${id}-i`, order_id: id, name: 'Fritanga', unit_price_cop: 6000, quantity: 2 }],
  ...extra,
});

/** What the BusinessOrdersPage specs share: their mocks, set-up and helpers. */
export function businessOrdersPageHarness() {
  const repo = { list: vi.fn(), setStatus: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.list.mockResolvedValue({
      data: [
        order('o1', 'pending', {
          notes: '<img src=x onerror=alert(1)> sin cebolla',
          customer_label: 'Ana P.',
        }),
        order('o22', 'preparing'),
        order('o333', 'picked_up'),
      ],
      errorKey: null,
    });
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'b1' })) } },
        {
          provide: OwnedBusinessRepository,
          useValue: { getMine: vi.fn().mockResolvedValue({ data: { id: 'b1' }, errorKey: null }) },
        },
        { provide: BusinessOrderRepository, useValue: repo },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  async function render() {
    const fixture = TestBed.createComponent(BusinessOrdersPage);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(text))!;
    return { fixture, el, button };
  }
  const h = {
    repo,
    render,
  };
  return h;
}
