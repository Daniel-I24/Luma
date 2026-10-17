import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessRepository } from '@shared/business/data/business.repository';
import { MenuRepository } from '@shared/business/data/menu.repository';
import { OwnedBusinessRepository } from '@shared/business/data/owned-business.repository';
import { BusinessDashboardPage } from './business-dashboard.page';

const business = {
  id: 'b1',
  name: 'Mi Fritanga',
  category: 'Restaurante',
  latitude: 1.21,
  longitude: -77.28,
  is_active: false,
};
const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('BusinessDashboardPage', () => {
  const owned = { getMine: vi.fn(), setPublished: vi.fn() };
  const businesses = { getHours: vi.fn() };
  const menus = { getMenu: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    owned.getMine.mockResolvedValue({ data: business, errorKey: null });
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
      ],
    });
  });

  async function render(hours: unknown[], items: unknown[]) {
    businesses.getHours.mockResolvedValue({ data: hours, errorKey: null });
    menus.getMenu.mockResolvedValue({ data: items, errorKey: null });
    const fixture = TestBed.createComponent(BusinessDashboardPage);
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const publishButton = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('businessPanel.dashboard.publish'),
    )!;

  it('lists what is missing and keeps "Publicar" disabled', async () => {
    const { el } = await render([{ is_closed: true }], []);

    expect(el.querySelector('#publish-missing')?.textContent).toContain(
      'businessPanel.requirements.openDay',
    );
    expect(el.querySelector('#publish-missing')?.textContent).toContain(
      'businessPanel.requirements.availableItem',
    );
    expect(publishButton(el).disabled).toBe(true);
    expect(publishButton(el).getAttribute('aria-describedby')).toBe('publish-missing');
  });

  it('publishes a complete business, then offers "Despublicar"', async () => {
    owned.setPublished.mockResolvedValue({ data: true, errorKey: null });
    const { el, fixture } = await render([{ is_closed: false }], [{ is_available: true }]);

    publishButton(el).click();
    await flush();
    fixture.detectChanges();

    expect(owned.setPublished).toHaveBeenCalledWith('b1', true);
    expect(el.textContent).toContain('businessPanel.dashboard.unpublish');
  });

  it('links to every section of the business', async () => {
    const { el } = await render([], []);

    const links = Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toEqual([
      '/business/b1/info',
      '/business/b1/hours',
      '/business/b1/menu',
      '/business/b1/promotions',
    ]);
  });

  it('shows "not found" for a business that is not the user\'s', async () => {
    owned.getMine.mockResolvedValue({ data: null, errorKey: null });
    const { el } = await render([], []);

    expect(el.textContent).toContain('businessPanel.notFound.title');
  });
});
