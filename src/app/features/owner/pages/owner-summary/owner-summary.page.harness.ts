import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, vi } from 'vitest';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { MenuRepository } from '@shared/business/data/menu.repository';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import { VerificationRepository } from '@shared/business/verification/verification.repository';
import { BusinessOrderRepository } from '@shared/orders/business-order.repository';
import { PROMOTION_ADVISOR } from '@shared/promotions/advisor/promotion-advisor';
import { OwnerSummaryPage } from './owner-summary.page';

const base = {
  id: 'b1',
  name: 'Mi Fritanga',
  category: 'Restaurante',
  address: 'Calle 18 # 25-30',
  latitude: 1.21,
  longitude: -77.28,
  phone: '3001234567',
  is_active: false,
  verification_status: 'draft',
  verification_note: null,
};

/** What the OwnerSummaryPage specs share: their mocks, set-up and helpers. */
export function ownerSummaryPageHarness() {
  const owned = { getMine: vi.fn(), setPublished: vi.fn(), listMine: vi.fn() };
  const businesses = { getHours: vi.fn() };
  const menus = { getMenu: vi.fn() };
  const verification = { getLegal: vi.fn(), listDocs: vi.fn(), submit: vi.fn() };
  const orders = { list: vi.fn() };
  const advisor = { suggest: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    owned.listMine.mockResolvedValue({ data: [], errorKey: null });
    businesses.getHours.mockResolvedValue({ data: [{ is_closed: false }], errorKey: null });
    menus.getMenu.mockResolvedValue({ data: [{ is_available: true }], errorKey: null });
    verification.getLegal.mockResolvedValue({ data: null, errorKey: null });
    verification.listDocs.mockResolvedValue({ data: [], errorKey: null });
    orders.list.mockResolvedValue({ data: [], errorKey: null });
    advisor.suggest.mockResolvedValue({ source: 'rules', ideas: [] });
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
        { provide: OwnedBusinessRepository, useValue: owned },
        { provide: BusinessRepository, useValue: businesses },
        { provide: MenuRepository, useValue: menus },
        { provide: VerificationRepository, useValue: verification },
        { provide: BusinessOrderRepository, useValue: orders },
        { provide: PROMOTION_ADVISOR, useValue: advisor },
      ],
    });
  });

  async function render(business: Record<string, unknown> = {}) {
    owned.getMine.mockResolvedValue({ data: { ...base, ...business }, errorKey: null });
    const fixture = TestBed.createComponent(OwnerSummaryPage);
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('#verification-title'),
      ).not.toBeNull();
    });
    const el = fixture.nativeElement as HTMLElement;
    const button = (key: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(key));
    return { fixture, el, button };
  }
  const h = {
    owned,
    businesses,
    menus,
    verification,
    orders,
    advisor,
    render,
  };
  return h;
}
