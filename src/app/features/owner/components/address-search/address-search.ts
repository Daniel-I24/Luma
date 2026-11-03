import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
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
  templateUrl: './address-search.html',
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
    const q = this.query().trim();
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
