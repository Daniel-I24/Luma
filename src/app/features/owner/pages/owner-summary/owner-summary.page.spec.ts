import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('OwnerSummaryPage', () => {
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

  it('"Verifica tu negocio, paso 1 de 3": three tappable steps with why, what is missing and "Completar" to the exact screen', async () => {
    const { el, button } = await render({ phone: null });

    expect(el.querySelector('#verification-title')?.textContent).toContain('owner.verification.progress');
    expect(el.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('1');
    const steps = Array.from(el.querySelectorAll<HTMLAnchorElement>('#review-missing a')).map((a) => [
      a.dataset['step'],
      a.getAttribute('href'),
      a.textContent?.includes('owner.verification.complete') ? 'completar' : 'listo',
    ]);
    expect(steps).toEqual([
      ['business', '/owner/b1/business/info', 'completar'],
      ['operation', '/owner/b1/business/hours', 'listo'],
      ['legal', '/owner/b1/business/verification', 'completar'],
    ]);
    expect(el.textContent).toContain('owner.verification.requirements.phone');
    expect(el.textContent).toContain('owner.verification.steps.business.why');
    expect(el.textContent).toContain('owner.verification.privacy');
    expect(el.textContent).toContain('owner.verification.time');
    expect(button('owner.verification.submit')?.disabled).toBe(true);
    expect(el.querySelector('#review-blocked')?.textContent).toContain('owner.verification.submitBlocked');
    expect(el.textContent).not.toContain('businessPanel.dashboard.publishTitle');
  });

  it('submits a complete draft and shows it under review', async () => {
    verification.getLegal.mockResolvedValue({ data: { tax_id: '800197268-4' }, errorKey: null });
    verification.listDocs.mockResolvedValue({
      data: [{ kind: 'rut' }, { kind: 'facade' }],
      errorKey: null,
    });
    verification.submit.mockResolvedValue({ data: { ok: true, missing: [] }, errorKey: null });
    const { fixture, el, button } = await render();

    button('owner.verification.submit')!.click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.textContent).toContain('verification.status.pending');
    });
    expect(verification.submit).toHaveBeenCalledWith('b1');
  });

  it('shows the team note and the way to fix a rejected business', async () => {
    const { el } = await render({
      verification_status: 'rejected',
      verification_note: 'Falta el RUT legible',
    });

    expect(el.textContent).toContain('Falta el RUT legible');
    expect(el.textContent).toContain('owner.verification.fix');
    expect(el.textContent).toContain('owner.verification.resubmit');
  });

  it('offers Publicado / Pausado only once verified', async () => {
    owned.setPublished.mockResolvedValue({ data: true, errorKey: null });
    const { fixture, el, button } = await render({ verification_status: 'approved' });

    button('businessPanel.dashboard.publish')!.click();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.textContent).toContain('owner.publish.pause');
    });
    expect(owned.setPublished).toHaveBeenCalledWith('b1', true);
  });
});
