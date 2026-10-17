import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, model } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaBottomSheet, LumaButton, LumaChip } from '@design-system';
import { NearbyBusinessesStore } from '../../state/nearby-businesses.store';
import {
  DISTANCE_OPTIONS,
  type DistanceOption,
  type MapFilters,
  NO_FILTERS,
  toggleCategory,
} from '../../utils/map-filters.util';

type Flag = 'openNow' | 'withPromotion' | 'goodRating';

/**
 * MapFilterSheet — bottom sheet with the map filters: open now, with a
 * promotion, rated 4 or more, distance (1, 3, 5 or 10 km; needs the user's
 * location) and categories. Changes apply at once to the loaded businesses.
 */
@Component({
  selector: 'app-map-filter-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaBottomSheet, LumaButton, LumaChip],
  templateUrl: './map-filter-sheet.html',
})
export class MapFilterSheet {
  protected readonly store = inject(NearbyBusinessesStore);
  private readonly document = inject(DOCUMENT);
  readonly open = model(false);

  protected readonly flags: readonly Flag[] = ['openNow', 'withPromotion', 'goodRating'];
  protected readonly distances = DISTANCE_OPTIONS;

  protected setFlag(flag: Flag, on: boolean): void {
    this.update((f) => ({ ...f, [flag]: on }));
  }

  protected setDistance(km: DistanceOption, on: boolean): void {
    this.update((f) => ({ ...f, maxDistanceKm: on ? km : null }));
  }

  protected toggle(category: string): void {
    this.update((f) => toggleCategory(f, category));
  }

  protected clear(): void {
    this.store.filters.set(NO_FILTERS);
  }

  protected close(): void {
    this.open.set(false);
    // Back to the button that opened the sheet.
    this.document.getElementById('map-filters-button')?.focus();
  }

  private update(change: (filters: MapFilters) => MapFilters): void {
    this.store.filters.update(change);
  }
}
