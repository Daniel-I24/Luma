import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MenuItem } from '@shared/business/models/menu.model';
import { MenuTab, groupBySection } from './menu-tab';

const item = (id: string, section: string | null, price: number): MenuItem => ({
  id,
  business_id: 'b1',
  name: `Plato ${id}`,
  description: null,
  price_cop: price,
  image_url: null,
  section,
  sort_order: 0,
  is_available: true,
  created_at: '',
});

const ES = {
  common: { retry: 'Reintentar' },
  businesses: { errors: { menuFailed: 'No se pudo cargar el menú.' } },
  businessProfile: {
    menu: {
      other: 'Otros',
      add: 'Agregar',
      ordersSoon: 'Pedir desde la app: próximamente.',
      emptyTitle: 'Menú no disponible',
      emptyDescription: 'Sin menú.',
      errorTitle: 'Error',
    },
  },
};

describe('MenuTab', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        MenuTab,
        TranslocoTestingModule.forRoot({
          langs: { es: ES },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
    });
  });

  function render(items: MenuItem[] | null): HTMLElement {
    const fixture = TestBed.createComponent(MenuTab);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('groups items by section in order of appearance, without a section last as "Otros"', () => {
    const sections = groupBySection([
      item('1', 'Bebidas', 4000),
      item('2', 'Postres', 7000),
      item('3', 'Bebidas', 5000),
      item('4', null, 1000),
    ]);

    expect(sections.map((s) => [s.name, s.items.map((i) => i.id)])).toEqual([
      ['Bebidas', ['1', '3']],
      ['Postres', ['2']],
      [null, ['4']],
    ]);
  });

  it('shows section headings and prices in Colombian pesos', () => {
    const el = render([item('1', 'Bebidas', 18900), item('2', null, 1500)]);

    const headings = Array.from(el.querySelectorAll('h3')).map((h) => h.textContent?.trim());
    expect(headings).toEqual(['Bebidas', 'Otros']);
    expect(el.textContent?.replace(/\s/g, ' ')).toContain('$ 18.900');
    expect(el.textContent?.replace(/\s/g, ' ')).toContain('$ 1.500');
  });

  it('keeps "Agregar" disabled and says ordering is coming soon', () => {
    const el = render([item('1', 'Bebidas', 4000)]);

    const add = el.querySelector('app-luma-button button') as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(add.getAttribute('aria-disabled')).toBe('true');
    expect(el.textContent).toContain('próximamente');
  });

  it('shows empty and error states', () => {
    expect(render([]).textContent).toContain('Menú no disponible');
    expect(render(null).textContent).toContain('No se pudo cargar el menú.');
  });
});
