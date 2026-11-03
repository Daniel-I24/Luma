import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { type IconName, LumaIcon, LumaSkeleton } from '@design-system';
import { ExternalUrls } from '@core/config/external-urls';
import type { Place, PlaceAttribution } from '@shared/geo/place-search.repository';

const KIND_ICON: Record<Place['kind'], IconName> = {
  address: 'pin',
  street: 'pin',
  neighbourhood: 'map',
  city: 'globe',
  poi: 'compass',
};

/**
 * PlaceResults — neighbourhoods, addresses and places for the submitted
 * search, under the search box. Choosing one flies the map there.
 */
@Component({
  selector: 'app-place-results',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaIcon, LumaSkeleton],
  template: `
    <section
      *transloco="let t"
      class="pointer-events-auto mx-4 max-h-72 overflow-y-auto rounded-lg border border-border-subtle bg-surface-elevated shadow-md"
      [attr.aria-label]="t('map.places.title')"
      aria-live="polite"
    >
      <header class="flex items-center justify-between gap-2 px-3 pt-2">
        <h2 class="m-0 text-caption font-semibold text-fg-muted">{{ t('map.places.title') }}</h2>
        <button
          type="button"
          class="min-h-11 min-w-11 rounded-md text-caption font-semibold text-fg-brand focus-visible:outline-2 focus-visible:outline-border-focus"
          (click)="dismiss.emit()"
        >
          {{ t('map.places.close') }}
        </button>
      </header>
      @if (loading()) {
        <div class="flex flex-col gap-2 px-3 pb-3">
          <app-luma-skeleton /><app-luma-skeleton /><app-luma-skeleton />
        </div>
      } @else if (errorKey()) {
        <p class="m-0 px-3 pb-3 text-body text-fg-muted" role="status">{{ t(errorKey()!) }}</p>
      } @else if (places()?.length === 0) {
        <p class="m-0 px-3 pb-3 text-body text-fg-muted" role="status">{{ t('map.places.none') }}</p>
      } @else {
        <ul class="m-0 list-none p-0 pb-1">
          @for (place of places(); track place.label) {
            <li>
              <button
                type="button"
                class="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-body text-fg hover:bg-surface focus-visible:outline-2 focus-visible:outline-border-focus"
                (click)="choose.emit(place)"
              >
                <app-luma-icon class="shrink-0 text-fg-brand" [name]="icon(place)" size="sm" />
                <span class="min-w-0 flex-1 truncate">{{ place.label }}</span>
                <span class="sr-only">{{ t('map.places.kind.' + place.kind) }}</span>
              </button>
            </li>
          }
        </ul>
        @if (attribution() === 'locationiq') {
          <p class="m-0 px-3 pb-2 text-caption text-fg-subtle">
            <a class="text-fg-muted underline" [href]="locationIqUrl" target="_blank" rel="noopener noreferrer">{{
              t('map.places.byLocationIq')
            }}</a>
          </p>
        }
      }
    </section>
  `,
})
export class PlaceResults {
  public readonly places = input<readonly Place[] | null>(null);
  public readonly loading = input(false);
  public readonly errorKey = input<string | null>(null);
  public readonly attribution = input<PlaceAttribution>(null);
  protected readonly locationIqUrl = ExternalUrls.LOCATIONIQ;

  public readonly choose = output<Place>();
  public readonly dismiss = output<void>();

  protected icon(place: Place): IconName {
    return KIND_ICON[place.kind];
  }
}
