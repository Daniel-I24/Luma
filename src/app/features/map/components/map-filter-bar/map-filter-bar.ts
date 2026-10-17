import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton, LumaChip } from '@design-system';
import { NearbyBusinessesStore } from '../../state/nearby-businesses.store';
import { type MapFilters, toggleCategory } from '../../utils/map-filters.util';
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
  templateUrl: './map-filter-bar.html',
})
export class MapFilterBar {
  protected readonly store = inject(NearbyBusinessesStore);
  protected readonly sheetOpen = signal(false);

  protected readonly chips = computed<ActiveChip[]>(() => {
    const f = this.store.filters();
    const chips: ActiveChip[] = [];
    const flag = (id: 'openNow' | 'withPromotion' | 'goodRating') =>
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
        remove: (x) => toggleCategory(x, category),
      });
    }
    return chips;
  });

  protected remove(chip: ActiveChip): void {
    this.store.filters.update(chip.remove);
  }
}
