import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Business } from '@shared/business/models/business.model';
import type { NearbyBusiness } from '../../state/nearby-businesses.store';
import { NearbyPanel } from './nearby-panel';

const ES = {
  status: {
    open: 'Abierto',
    closed: 'Cerrado',
    openingSoon: 'Abre pronto',
    closingSoon: 'Cierra pronto',
  },
  rating: { label: 'Calificación {{rating}} de 5' },
  map: {
    nearby: { title: 'Cercanos a ti' },
    loadingBusinesses: 'Cargando negocios…',
    retry: 'Reintentar',
    errors: { title: 'Algo salió mal' },
    noBusinesses: 'No hay negocios cercanos',
    empty: { description: 'Mueve el mapa.' },
    noResults: { title: 'Sin resultados', description: 'Nada coincide.', clear: 'Quitar filtros' },
    ai: { cta: 'Ver recomendaciones de Luma IA' },
  },
  businesses: { errors: { loadFailed: 'No se pudieron cargar los negocios.' } },
};

const item = (id: string, distanceKm: number | null): NearbyBusiness => ({
  business: { id, name: `Negocio ${id}`, category: 'Café', logo_url: null } as Business,
  status: 'open',
  distanceKm,
  rating: { rating: 4.8, reviewCount: 20 },
});

describe('NearbyPanel', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        NearbyPanel,
        TranslocoTestingModule.forRoot({
          langs: { es: ES },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
    });
  });

  function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(NearbyPanel);
    for (const [key, value] of Object.entries({ items: [], ...inputs })) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows skeletons and marks the region busy while loading', () => {
    const { el } = render({ loading: true });

    expect(el.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
    expect(el.querySelectorAll('app-luma-skeleton').length).toBeGreaterThan(0);
  });

  it('renders one card per business with its formatted distance', () => {
    const { el } = render({ items: [item('a', 0.45), item('b', null)] });

    const cards = el.querySelectorAll('app-luma-business-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('450 m');
  });

  it('emits the business when a card is selected', () => {
    const { fixture, el } = render({ items: [item('a', 1)] });
    const selected: NearbyBusiness[] = [];
    fixture.componentInstance.selectBusiness.subscribe((b) => selected.push(b));

    el.querySelector<HTMLButtonElement>('app-luma-business-card button')?.click();

    expect(selected[0].business.id).toBe('a');
  });

  it('shows the error state with a retry action', () => {
    const { fixture, el } = render({ errorKey: 'businesses.errors.loadFailed' });
    let retries = 0;
    fixture.componentInstance.retry.subscribe(() => retries++);

    expect(el.textContent).toContain('No se pudieron cargar los negocios.');
    el.querySelector<HTMLButtonElement>('app-luma-empty-state button')?.click();
    expect(retries).toBe(1);
  });

  it('distinguishes no results for the filters from no businesses at all', () => {
    expect(render({ filtersActive: true }).el.textContent).toContain('Sin resultados');
    expect(render({ filtersActive: false }).el.textContent).toContain('No hay negocios cercanos');
  });
});
