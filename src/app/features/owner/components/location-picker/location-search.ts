import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ExternalUrls } from '@core/config/external-urls';
import { TextRules } from '@core/validation/text-rules';
import { LumaButton, LumaInput } from '@design-system';
import { Distance } from '@shared/geo/distance';
import type { GeoCoords } from '@shared/geo/geolocation.service';
import { type PlaceAttribution, PlaceSearchRepository } from '@shared/geo/place-search.repository';
import { type Candidate, LocationChecks, MUNICIPALITY_RADIUS_KM } from './location-checks';

const MIN_QUERY = 3;
const MAX_QUERY = 80;

/**
 * LocationSearch — "Buscar" of the LocationPicker: sent only when the owner
 * presses it (the provider quota), bounded to the chosen municipality; up
 * to 5 candidates with their type and distance to the centre. Choosing one
 * moves the map but never confirms; "Ninguno: lo muevo yo" closes the list.
 */
@Component({
  selector: 'app-location-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaInput],
  template: `
    <!-- Not a <form>: it lives inside the business form, and Enter must not submit that one. -->
    <div *transloco="let t" class="flex flex-col gap-2" role="search" (keydown.enter)="search($event)">
      <div class="flex items-end gap-2">
        <app-luma-input class="flex-1" [inputId]="idPrefix() + '-location-search'" [label]="t('location.search.label')"
          [placeholder]="t('location.search.placeholder')" [maxLength]="maxQuery" [value]="query()" (valueChange)="query.set($event)" />
        <app-luma-button variant="secondary" [disabled]="busy()" (clicked)="search()">{{ t('location.search.submit') }}</app-luma-button>
      </div>
      @if (errorKey(); as key) {
        <p class="m-0 text-body-sm text-fg-muted" role="status">{{ t(key) }}</p>
      }
      @if (results(); as list) {
        <ul class="m-0 flex list-none flex-col gap-1 p-0" [attr.aria-label]="t('location.search.results')">
          @for (candidate of list; track candidate.label) {
            <li>
              <app-luma-button variant="ghost" [fullWidth]="true" (clicked)="preview(candidate)">
                {{ candidate.label }} · {{ t('map.places.kind.' + candidate.kind) }} · {{ distance(candidate) }}
              </app-luma-button>
            </li>
          } @empty {
            <li class="text-body-sm text-fg-muted">{{ t('location.search.none') }}</li>
          }
          <li><app-luma-button variant="link" (clicked)="results.set(null)">{{ t('location.search.dismiss') }}</app-luma-button></li>
        </ul>
        @if (attribution() === 'locationiq') {
          <a class="text-caption text-fg-muted underline" [href]="locationIqUrl" target="_blank" rel="noopener noreferrer">{{ t('map.places.byLocationIq') }}</a>
        }
      }
    </div>
  `,
})
export class LocationSearch {
  private readonly places = inject(PlaceSearchRepository);
  private readonly transloco = inject(TranslocoService);

  public readonly idPrefix = input.required<string>();
  /** Bias point (the map centre). */
  public readonly near = input.required<GeoCoords>();
  /** Centre of the chosen municipality (DANE); null until one is chosen. */
  public readonly centre = input<GeoCoords | null>(null);
  /** A candidate to look at: the map moves there, nothing is confirmed. */
  public readonly previewed = output<Candidate>();

  protected readonly query = signal('');
  protected readonly results = signal<readonly Candidate[] | null>(null);
  protected readonly attribution = signal<PlaceAttribution>(null);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly maxQuery = MAX_QUERY;
  protected readonly locationIqUrl = ExternalUrls.LOCATIONIQ;

  protected async search(event?: Event): Promise<void> {
    event?.preventDefault();
    const q = TextRules.search.normalize(this.query());
    if (q.length < MIN_QUERY || this.busy()) return;
    this.busy.set(true);
    const centre = this.centre();
    try {
      const result = await this.places.search(q, this.near(), centre ? { ...centre, radiusKm: MUNICIPALITY_RADIUS_KM } : undefined);
      this.results.set(result.places ? LocationChecks.candidates(result.places, centre) : null);
      this.attribution.set(result.attribution ?? null);
      this.errorKey.set(result.errorKey);
    } finally {
      this.busy.set(false);
    }
  }

  protected preview(candidate: Candidate): void {
    this.previewed.emit(candidate);
  }

  protected distance(candidate: Candidate): string {
    return this.transloco.translate('location.search.fromCentre', {
      distance: Distance.formatDistance(candidate.km, this.transloco.getActiveLang()),
    });
  }
}
