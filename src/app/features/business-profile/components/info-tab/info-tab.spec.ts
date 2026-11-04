import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessPhotoRepository } from '@shared/business/data/business-photo.repository';
import { TrustSummaryRepository } from '@shared/business/data/trust-summary.repository';
import { RouteRepository } from '@shared/route/route.repository';
import type { Business, BusinessHours } from '@shared/business/models/business.model';
import { InfoTab } from './info-tab';
import { useFixedClock } from '../../../../../testing/fixed-clock';

const ES = {
  businessProfile: {
    info: {
      hours: 'Horario',
      noHours: 'Horario no disponible',
      today: 'Hoy',
      closed: 'Cerrado',
      contact: 'Contacto',
      call: 'Llamar al {{phone}}',
      address: 'Dirección',
    },
  },
};

const VERIFIED = '2026-10-01T00:00:00Z';
const business = { id: 'b1', phone: '+573001112233', phone_verified_at: VERIFIED, address: 'Calle 19 # 22-40', latitude: 1.21, longitude: -77.28 } as Business;
const day = (d: BusinessHours['day_of_week'], closed = false): BusinessHours => ({
  id: `h${d}`,
  business_id: 'b1',
  day_of_week: d,
  opens_at: '08:30:00',
  closes_at: '19:00:00',
  is_closed: closed,
});

describe('InfoTab', () => {
  useFixedClock();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        InfoTab,
        TranslocoTestingModule.forRoot({
          langs: { es: ES },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        { provide: BusinessPhotoRepository, useValue: { list: vi.fn().mockResolvedValue({ data: [], errorKey: null }) } },
        { provide: TrustSummaryRepository, useValue: { get: vi.fn().mockResolvedValue({ data: null, errorKey: null }) } },
        { provide: RouteRepository, useValue: { route: vi.fn() } },
      ],
    });
  });

  function render(hours: BusinessHours[], biz: Business = business): HTMLElement {
    const fixture = TestBed.createComponent(InfoTab);
    fixture.componentRef.setInput('business', biz);
    fixture.componentRef.setInput('hours', hours);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists the week from Monday with hours and closed days', () => {
    const rows = Array.from(render([day(1), day(0, true)]).querySelectorAll('li'));

    expect(rows).toHaveLength(7);
    expect(rows[0]?.textContent).toContain('Lunes');
    expect(rows[0]?.textContent).toContain('08:30 – 19:00');
    expect(rows[6]?.textContent).toContain('Domingo');
    expect(rows[6]?.textContent).toContain('Cerrado');
  });

  it('highlights today (the fixed clock is a Wednesday)', () => {
    const today = Array.from(render([day(1)]).querySelectorAll('li')).filter(
      (li) => li.getAttribute('aria-current') === 'date',
    );

    expect(today).toHaveLength(1);
    expect(today[0]?.textContent).toContain('Hoy');
    expect(today[0]?.textContent?.toLowerCase()).toContain('miércoles');
  });

  it('offers a tel: link and the address', () => {
    const el = render([]);

    expect(el.querySelector('a')?.getAttribute('href')).toBe('tel:+573001112233');
    expect(el.textContent).toContain('Calle 19 # 22-40');
    expect(el.textContent).toContain('Horario no disponible');
  });

  it('links WhatsApp, Instagram and the website in a new tab, never unsafe values', () => {
    const el = render([], {
      ...business,
      whatsapp: '+573001234567',
      whatsapp_verified_at: VERIFIED,
      instagram: 'cafe.publico',
      instagram_verified_at: VERIFIED,
      facebook: null,
      website: 'javascript:alert(1)',
      website_verified_at: VERIFIED,
    });
    const external = Array.from(el.querySelectorAll('[aria-labelledby="info-contact"] a[target="_blank"]'));
    expect(external.map((a) => a.getAttribute('href'))).toEqual([
      'https://wa.me/573001234567',
      'https://instagram.com/cafe.publico',
    ]);
    expect(external.every((a) => a.getAttribute('rel') === 'noopener noreferrer')).toBe(true);
  });

  it('shows customers only the contacts the team verified, each with its badge', () => {
    const el = render([], { ...business, phone_verified_at: null, whatsapp: '+573001234567', instagram: 'cafe.publico', instagram_verified_at: VERIFIED });

    expect(el.querySelector('a[href^="tel:"]')).toBeNull();
    expect(el.querySelector('a[href^="https://wa.me"]')).toBeNull();
    const instagram = el.querySelector('a[href="https://instagram.com/cafe.publico"]');
    expect(instagram?.textContent).toContain('contactVerification.verified');
  });
});
