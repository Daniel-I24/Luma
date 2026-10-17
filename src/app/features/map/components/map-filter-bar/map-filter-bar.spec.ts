import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it } from 'vitest';
import { NearbyBusinessesStore } from '../../state/nearby-businesses.store';
import { type MapFilters, NO_FILTERS, activeFilterCount } from '../../utils/map-filters.util';
import { MapFilterBar } from './map-filter-bar';

describe('MapFilterBar', () => {
  const filters = signal<MapFilters>(NO_FILTERS);
  const located = signal(false);
  const store = {
    filters,
    filterCount: computed(() => activeFilterCount(filters())),
    canFilterDistance: located,
    categories: signal(['Bar', 'Café']),
    items: signal([]),
  };

  beforeEach(() => {
    filters.set(NO_FILTERS);
    located.set(false);
    TestBed.configureTestingModule({
      imports: [
        MapFilterBar,
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [{ provide: NearbyBusinessesStore, useValue: store }],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(MapFilterBar);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the number of active filters and one removable chip per filter', () => {
    filters.set({ ...NO_FILTERS, openNow: true, maxDistanceKm: 3, categories: ['Bar'] });
    const { fixture, el } = render();

    expect(el.querySelector('#map-filters-button')?.textContent).toContain(
      'map.filters.buttonCount',
    );
    const chips = el.querySelectorAll('.luma-chip--dismissible');
    expect(chips).toHaveLength(3);
    expect(chips[2].textContent).toContain('Bar');

    chips[0].querySelector('button')!.click();
    fixture.detectChanges();
    expect(filters().openNow).toBe(false);
    expect(el.querySelectorAll('.luma-chip--dismissible')).toHaveLength(2);
  });

  it('opens the sheet; distance needs the location; filters apply at once', () => {
    const { fixture, el } = render();
    el.querySelector<HTMLButtonElement>('#map-filters-button')!.click();
    fixture.detectChanges();

    const distanceChips = Array.from(
      el.querySelectorAll('[aria-labelledby="map-filters-distance"] .luma-chip'),
    );
    expect(distanceChips).toHaveLength(4);
    expect(distanceChips.every((chip) => chip.getAttribute('aria-disabled') === 'true')).toBe(true);
    expect(el.textContent).toContain('map.filters.distanceNeedsLocation');

    const promo = Array.from(el.querySelectorAll<HTMLElement>('.luma-chip')).find((c) =>
      c.textContent?.includes('map.filters.withPromotion'),
    )!;
    promo.click();
    fixture.detectChanges();
    expect(filters().withPromotion).toBe(true);
  });
});
