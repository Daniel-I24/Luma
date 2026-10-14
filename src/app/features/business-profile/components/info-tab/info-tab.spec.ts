import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Business, BusinessHours } from '@shared/business/models/business.model';
import { InfoTab } from './info-tab';

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

const business = { id: 'b1', phone: '+573001112233', address: 'Calle 19 # 22-40' } as Business;
const day = (d: BusinessHours['day_of_week'], closed = false): BusinessHours => ({
  id: `h${d}`,
  business_id: 'b1',
  day_of_week: d,
  opens_at: '08:30:00',
  closes_at: '19:00:00',
  is_closed: closed,
});

describe('InfoTab', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        InfoTab,
        TranslocoTestingModule.forRoot({
          langs: { es: ES },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
    });
  });

  function render(hours: BusinessHours[]): HTMLElement {
    const fixture = TestBed.createComponent(InfoTab);
    fixture.componentRef.setInput('business', business);
    fixture.componentRef.setInput('hours', hours);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists the week from Monday with hours and closed days', () => {
    const rows = Array.from(render([day(1), day(0, true)]).querySelectorAll('li'));

    expect(rows).toHaveLength(7);
    expect(rows[0].textContent).toContain('Lunes');
    expect(rows[0].textContent).toContain('08:30 – 19:00');
    expect(rows[6].textContent).toContain('Domingo');
    expect(rows[6].textContent).toContain('Cerrado');
  });

  it('highlights today', () => {
    const today = Array.from(render([day(1)]).querySelectorAll('li')).filter(
      (li) => li.getAttribute('aria-current') === 'date',
    );

    expect(today).toHaveLength(1);
    expect(today[0].textContent).toContain('Hoy');
  });

  it('offers a tel: link and the address', () => {
    const el = render([]);

    expect(el.querySelector('a')?.getAttribute('href')).toBe('tel:+573001112233');
    expect(el.textContent).toContain('Calle 19 # 22-40');
    expect(el.textContent).toContain('Horario no disponible');
  });
});
