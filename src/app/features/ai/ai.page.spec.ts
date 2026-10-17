import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import type { Business } from '@shared/business/models/business.model';
import type { MenuItem } from '@shared/business/models/menu.model';
import { CartStore } from '@shared/cart/cart.store';
import type { Recommendation } from '@shared/recommendations/recommendation.model';
import { AiPage } from './ai.page';
import { AiStore } from './state/ai.store';

const business = { id: 'b1', name: 'Café La Merced', category: 'Cafetería' } as Business;
const menuItem = (id: string, price_cop: number) => ({ id, business_id: 'b1', name: id, price_cop }) as MenuItem;
const result: Recommendation = {
  businesses: [
    {
      candidate: { business, status: 'open', distanceKm: null, rating: 4.2, hasPromotion: true, isFavorite: false, menu: [] },
      score: 70,
      reasons: ['moment', 'promotion'],
    },
  ],
  combo: {
    business,
    items: { main: menuItem('Desayuno', 16000), side: menuItem('Croissant', 7000), drink: menuItem('Capuchino', 6500) },
    totalCop: 29500,
  },
};

describe('AiPage', () => {
  const store = {
    moment: signal('breakfast'),
    state: signal('ready'),
    result: signal<Recommendation | null>(result),
    load: vi.fn(),
    selectMoment: vi.fn(),
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [
        AiPage,
        TranslocoTestingModule.forRoot({
          langs: { es: { ai: { moments: { lunch: 'Almuerzo', breakfast: 'Desayuno' }, combo: { add: 'Agregar combo' } } } },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [provideRouter([]), { provide: AuthService, useValue: { user: signal({ id: 'u1' }) } }],
    }).overrideComponent(AiPage, { set: { providers: [{ provide: AiStore, useValue: store }] } });
  });

  function render() {
    const fixture = TestBed.createComponent(AiPage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('preselects the current moment and changes it from the chips', () => {
    const el = render();
    const chips = Array.from(el.querySelectorAll<HTMLElement>('.luma-chip'));

    expect(chips).toHaveLength(6);
    expect(chips[0].getAttribute('aria-pressed')).toBe('true');
    chips.find((c) => c.textContent?.includes('Almuerzo'))!.click();
    expect(store.selectMoment).toHaveBeenCalledWith('lunch');
  });

  it('shows the picks and adds the whole combo to the cart', () => {
    const el = render();

    expect(el.querySelector('app-recommendation-list')?.textContent).toContain('Café La Merced');
    const add = Array.from(el.querySelectorAll<HTMLButtonElement>('app-combo-card button'));
    add.find((b) => b.textContent?.includes('Agregar combo'))!.click();

    const cart = TestBed.inject(CartStore);
    expect(cart.items().map((i) => i.menuItemId)).toEqual(['Desayuno', 'Croissant', 'Capuchino']);
    expect(cart.totalCop()).toBe(29500);
  });
});
