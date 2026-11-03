import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaChip } from '@design-system';
import { NearbyBusinessesStore } from '../../state/nearby-businesses.store';
import { type MapFilters, MapFilterRules } from '../../utils/map-filter-rules';
import { MapFilterSheet } from '../map-filter-sheet/map-filter-sheet';

/** One active filter as a removable chip. */
interface ActiveChip {
  readonly id: string;
  /** Translation key, or the category name itself. */
  readonly key: string | null;
  readonly text: string;
  readonly params: Record<string, number>;
  readonly remove: (filters: MapFilters) => MapFilters;
}

/**
 * MapFilterBar — "Filtros" button with the number of active filters, one
 * removable chip per active filter, and the filters sheet.
 */
@Component({
  selector: 'app-map-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaChip, MapFilterSheet],
  template: `
    <ng-container *transloco="let t">
      <div
        class="pointer-events-auto flex items-center gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none]"
        role="group"
        [attr.aria-label]="t('map.filters.title')"
      >
        <app-luma-button
          class="shrink-0"
          variant="secondary"
          size="sm"
          buttonId="map-filters-button"
          [ariaLabel]="t('map.filters.open', { count: store.filterCount() })"
          (clicked)="sheetOpen.set(true)"
          >{{ store.filterCount() ? t('map.filters.buttonCount', { count: store.filterCount() }) : t('map.filters.button') }}</app-luma-button
        >
        @for (chip of chips(); track chip.id) {
        <app-luma-chip class="shrink-0 shadow-sm" variant="primary" [dismissible]="true" (dismissed)="remove(chip)">{{
          chip.key ? t(chip.key, chip.params) : chip.text
        }}</app-luma-chip>
        }
      </div>
      <app-map-filter-sheet [(open)]="sheetOpen" />
    </ng-container>
  `,
})
export class MapFilterBar {
  protected readonly store = inject(NearbyBusinessesStore);
  protected readonly sheetOpen = signal(false);

  protected readonly chips = computed<ActiveChip[]>(() => {
    const f = this.store.filters();
    const chips: ActiveChip[] = [];
    const flag = (id: 'openNow' | 'withPromotion' | 'goodRating'): number =>
      chips.push({
        id,
        key: `map.filters.${id}`,
        text: '',
        params: {},
        remove: (x) => ({ ...x, [id]: false }),
      });
    if (f.openNow) flag('openNow');
    if (f.withPromotion) flag('withPromotion');
    if (f.goodRating) flag('goodRating');
    if (f.maxDistanceKm !== null) {
      chips.push({
        id: 'distance',
        key: 'map.filters.withinKm',
        text: '',
        params: { km: f.maxDistanceKm },
        remove: (x) => ({ ...x, maxDistanceKm: null }),
      });
    }
    for (const category of f.categories) {
      chips.push({
        id: `c:${category}`,
        key: null,
        text: category,
        params: {},
        remove: (x) => MapFilterRules.toggleCategory(x, category),
      });
    }
    return chips;
  });

  protected remove(chip: ActiveChip): void {
    this.store.filters.update(chip.remove);
  }
}
