import { ChangeDetectionStrategy, Component, effect, inject, input, model, untracked } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIcon, LumaSearchInput } from '@design-system';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { MapCameraService } from '../../services/map-camera.service';
import type { Place } from '@shared/geo/place-search.repository';
import { PlaceSearchStore } from '../../state/place-search.store';
import { MapFilterBar } from '../map-filter-bar/map-filter-bar';
import { PlaceResults } from '../place-results/place-results';

/**
 * MapTopBar — floating controls over the map: one search box (businesses
 * filter while typing; Enter or "Buscar lugares" also looks up
 * neighbourhoods, addresses and places), zone indicator and the filters.
 */
@Component({
  selector: 'app-map-top-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIcon, LumaSearchInput, MapFilterBar, PlaceResults],
  templateUrl: './map-top-bar.html',
  host: {
    class:
      'pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 pt-[calc(env(safe-area-inset-top)+var(--spacing-3))]',
  },
})
export class MapTopBar {
  protected readonly places = inject(PlaceSearchStore);
  private readonly camera = inject(MapCameraService);
  private readonly geo = inject(GeolocationService);

  /** i18n key of the zone indicator. */
  readonly zoneKey = input.required<string>();

  readonly query = model('');

  constructor() {
    // Results belong to the submitted text: editing it closes them.
    effect(() => {
      const query = this.query().trim();
      untracked(() => {
        if (this.places.open() && query !== this.places.searched()) this.places.close();
      });
    });
  }

  protected searchPlaces(event?: Event): void {
    event?.preventDefault();
    // Bias: where the user looks at (the map centre), else their position.
    const near = this.mapCentre() ?? this.geo.coords();
    void this.places.search(this.query(), near);
  }

  protected goTo(place: Place): void {
    this.places.close();
    this.camera.showPlace(place.lat, place.lng, place.label);
  }

  private mapCentre(): { lat: number; lng: number } | null {
    try {
      return this.camera.currentCenter();
    } catch {
      return null;
    }
  }
}
