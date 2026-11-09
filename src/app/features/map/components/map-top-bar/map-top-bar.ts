import { ChangeDetectionStrategy, Component, effect, inject, input, model, output, untracked } from '@angular/core';
import { TourHelpButton } from '@shared/tutorial/tour-help-button';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaIcon, LumaSearchInput } from '@design-system';
import { GeolocationService } from '@shared/geo/geolocation.service';
import { MapCameraService } from '../../services/map-camera.service';
import type { Place } from '@shared/geo/place-search.repository';
import { PlaceSearchStore } from '../../state/place-search.store';
import { MapFilterBar } from '../map-filter-bar/map-filter-bar';
import { PlaceResults } from '../place-results/place-results';
import type { ZoneText } from '../../utils/zone-label';

/**
 * MapTopBar — floating controls over the map: one search box (businesses
 * filter while typing; Enter or "Buscar lugares" also looks up
 * neighbourhoods, addresses and places), zone indicator and the filters.
 */
@Component({
  selector: 'app-map-top-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TourHelpButton, TranslocoModule, LumaIcon, LumaSearchInput, MapFilterBar, PlaceResults],
  template: `
    <ng-container *transloco="let t">
      <form class="pointer-events-auto mx-4" role="search" data-tour="map-search" (submit)="searchPlaces($event)">
        <app-luma-search-input
          inputId="map-search"
          [label]="t('map.search.label')"
          [placeholder]="t('map.search.placeholder')"
          [clearLabel]="t('map.search.clear')"
          [(value)]="query"
        />
      </form>

      @if (places.open()) {
        <app-place-results
          [places]="places.places()"
          [loading]="places.loading()"
          [errorKey]="places.errorKey()"
          [attribution]="places.attribution()"
          (choose)="goTo($event)"
          (dismiss)="places.close()"
        />
      } @else if (places.canSearch(query())) {
        <button
          type="button"
          class="pointer-events-auto mx-4 inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-border-subtle bg-surface-elevated px-4 text-caption font-semibold text-fg-brand shadow-sm focus-visible:outline-2 focus-visible:outline-border-focus"
          (click)="searchPlaces()"
        >
          <app-luma-icon name="search" size="sm" />
          {{ t('map.places.search', { query: query().trim() }) }}
        </button>
      }

      <div class="mx-4 flex flex-wrap items-center gap-2">
        <p
          class="pointer-events-auto m-0 inline-flex max-w-full items-center gap-1 rounded-full border border-border-subtle bg-surface-elevated px-3 py-1 text-caption font-semibold text-fg-muted shadow-sm"
          role="status"
        >
          <app-luma-icon class="text-fg-brand" name="pin" size="sm" />
          {{ t(zone().key, zone().params) }}
        </p>
        @if (canReturn()) {
          <button
            type="button"
            class="pointer-events-auto inline-flex min-h-11 items-center gap-1 rounded-full border border-border-subtle bg-surface-elevated px-3 text-caption font-semibold text-fg-brand shadow-sm focus-visible:outline-2 focus-visible:outline-border-focus"
            (click)="returnToMe.emit()"
          >
            <app-luma-icon name="locate" size="sm" />
            {{ t('map.zone.backToMe') }}
          </button>
        }
      </div>

      <div class="flex items-center gap-2 pe-4">
        <app-map-filter-bar class="min-w-0 flex-1" data-tour="map-filters" />
        <app-tour-help-button class="pointer-events-auto shrink-0 rounded-full bg-surface-elevated shadow-sm" id="map" />
      </div>
    </ng-container>
  `,
  host: {
    class:
      'pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 ps-[env(safe-area-inset-left)] pe-[env(safe-area-inset-right)] pt-[calc(env(safe-area-inset-top)+var(--spacing-3))]',
  },
})
export class MapTopBar {
  protected readonly places = inject(PlaceSearchStore);
  private readonly camera = inject(MapCameraService);
  private readonly geo = inject(GeolocationService);

  /** What the zone indicator says. */
  public readonly zone = input.required<ZoneText>();
  /** The map shows somewhere else than the user. */
  public readonly canReturn = input(false);
  public readonly returnToMe = output<void>();

  public readonly query = model('');

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
