import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { TextRules } from '@core/validation/text-rules';
import { LumaButton, LumaInput } from '@design-system';
import { ExternalUrls } from '@core/config/external-urls';
import type { GeoCoords } from '@shared/geo/geolocation.service';
import { type Place, type PlaceAttribution, PlaceSearchRepository } from '@shared/geo/place-search.repository';

const MIN_QUERY = 3;

/**
 * AddressSearch — "Buscar la dirección" above the location picker: the
 * geocode function (Colombia only, quota per user) finds the address; the
 * owner picks a result and then fine-tunes the pin by dragging it.
 */
@Component({
  selector: 'app-address-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaInput],
  template: `
    <div *transloco="let t" class="flex flex-col gap-2">
      <div class="flex items-end gap-2">
        <app-luma-input
          class="flex-1"
          [inputId]="idPrefix() + '-address-search'"
          [label]="t('owner.wizard.addressSearch')"
          [placeholder]="t('owner.wizard.addressPlaceholder')"
          [maxLength]="80"
          autocomplete="street-address"
          [value]="query()"
          (valueChange)="query.set($event)"
        />
        <app-luma-button variant="secondary" [disabled]="busy()" (clicked)="search()">{{ t('owner.wizard.search') }}</app-luma-button>
      </div>
      @if (errorKey(); as key) {
      <p class="m-0 text-body-sm text-fg-muted" role="status">{{ t(key) }}</p>
      } @if (results(); as list) {
      <ul class="m-0 flex list-none flex-col gap-1 p-0" [attr.aria-label]="t('map.places.title')">
        @for (place of list; track place.label) {
        <li>
          <app-luma-button variant="ghost" [fullWidth]="true" (clicked)="pick(place)">{{ place.label }}</app-luma-button>
        </li>
        } @empty {
        <li class="text-body-sm text-fg-muted">{{ t('map.places.none') }}</li>
        }
      </ul>
      @if (attribution() === 'locationiq') {
      <a class="text-caption text-fg-muted underline" [href]="locationIqUrl" target="_blank" rel="noopener noreferrer">{{ t('map.places.byLocationIq') }}</a>
      } }
    </div>
  `,
})
export class AddressSearch {
  private readonly places = inject(PlaceSearchRepository);

  public readonly idPrefix = input.required<string>();
  /** Bias point of the search (the current pin, or Pasto). */
  public readonly near = input.required<GeoCoords>();
  public readonly chosen = output<Place>();

  protected readonly query = signal('');
  protected readonly results = signal<readonly Place[] | null>(null);
  protected readonly attribution = signal<PlaceAttribution>(null);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly locationIqUrl = ExternalUrls.LOCATIONIQ;

  protected async search(): Promise<void> {
    const q = TextRules.search.normalize(this.query());
    if (q.length < MIN_QUERY || this.busy()) return;
    this.busy.set(true);
    this.errorKey.set(null);
    try {
      const result = await this.places.search(q, this.near());
      this.results.set(result.places);
      this.attribution.set(result.attribution ?? null);
      this.errorKey.set(result.errorKey);
    } finally {
      this.busy.set(false);
    }
  }

  protected pick(place: Place): void {
    this.results.set(null);
    this.chosen.emit(place);
  }
}
