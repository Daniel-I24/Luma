import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CartActions } from '@shared/cart/cart-actions.service';
import { PromotionDealRepository } from '@shared/promotions/promotion-deal.repository';
import { PromotionsPage } from './promotions.page';

const hours = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day_of_week: day,
  opens_at: '00:00:00',
  closes_at: '23:59:00',
  is_closed: false,
}));
const entry = (id: string, percent: number | null, category = 'Bar') => ({
  hours,
  deal: {
    id,
    title: `Promo ${id}`,
    description: null,
    imageUrl: null,
    startsAt: '2026-10-01T00:00:00Z',
    endsAt: '2099-01-01T00:00:00Z',
    discountPercent: percent,
    item: percent
      ? {
          id: `m-${id}`,
          name: 'Tinto',
          imageUrl: null,
          listCop: 2000,
          finalCop: 1500,
          available: true,
        }
      : null,
    business: { id: `b-${id}`, name: `Café ${id}`, category, latitude: 1.21, longitude: -77.28 },
  },
});

describe('PromotionsPage', () => {
  const repo = { listCurrent: vi.fn(), listForBusiness: vi.fn() };
  const cart = { add: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [
        PromotionsPage,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: PromotionDealRepository, useValue: repo },
        { provide: CartActions, useValue: cart },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(PromotionsPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.querySelector('[aria-busy="true"]')).toBeNull();
    });
    return { fixture, el };
  }

  it('shows each deal with its discount, prices and "Pedir", which adds the final price', async () => {
    repo.listCurrent.mockResolvedValue({ data: [entry('a', 25)], errorKey: null });
    const { el } = await render();

    const card = el.querySelector('app-promotion-card')!;
    expect(card.textContent).toContain('promotions.card.discount');
    expect(card.querySelector('.line-through')).not.toBeNull();
    expect(card.querySelector('a')?.getAttribute('href')).toBe('/businesses/b-a');
    Array.from(card.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('promotions.card.order'))!
      .click();
    expect(cart.add).toHaveBeenCalledWith({
      menuItemId: 'm-a',
      businessId: 'b-a',
      businessName: 'Café a',
      name: 'Tinto',
      priceCop: 1500,
    });
  });

  it('filters by minimum discount and offers to clear filters when nothing matches', async () => {
    repo.listCurrent.mockResolvedValue({
      data: [entry('a', 10), entry('b', null)],
      errorKey: null,
    });
    const { fixture, el } = await render();
    expect(el.querySelectorAll('app-promotion-card').length).toBe(2);

    const min = el.querySelector<HTMLSelectElement>('#promo-min')!;
    min.value = '50';
    min.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(el.querySelectorAll('app-promotion-card').length).toBe(0);
    expect(el.textContent).toContain('promotions.empty.filteredTitle');
    expect(el.textContent).toContain('promotions.filters.clear');
  });

  it('shows the error with a retry', async () => {
    repo.listCurrent.mockResolvedValue({ data: null, errorKey: 'promotions.errors.loadFailed' });
    const { el } = await render();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'promotions.errors.loadFailed',
    );
    expect(el.textContent).toContain('common.retry');
  });
});
