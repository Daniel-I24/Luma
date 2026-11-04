import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaButton } from '@design-system';
import type { GeoCoords } from '@shared/geo/geolocation.service';
import { type ApproximateAddress, PlaceSearchRepository } from '@shared/geo/place-search.repository';

/** What "Usar esta dirección" fills in (both stay editable). */
export interface AddressProposal {
  readonly address: string;
  readonly neighborhood: string;
}

/**
 * LocationProposal — one reverse geocoding call for each confirmed point:
 * proposes an address and a sector, marked "aproximado". Nothing is filled
 * in until the owner chooses "Usar esta dirección", and both fields stay
 * editable; the owner writes the real address.
 */
@Component({
  selector: 'app-location-proposal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton],
  template: `
    @if (proposal(); as p) {
      <div *transloco="let t" class="flex flex-col gap-2 rounded-md border border-border-subtle bg-surface-elevated p-3" role="status">
        <p class="m-0 text-label text-fg">{{ t('location.proposal.title') }}</p>
        <p class="m-0 text-body-sm text-fg">{{ p.address || t('location.proposal.noAddress') }}</p>
        @if (p.neighborhood) {
          <p class="m-0 text-body-sm text-fg-muted">{{ t('location.proposal.sector', { sector: p.neighborhood }) }}</p>
        }
        <p class="m-0 text-caption text-fg-muted">{{ t('location.proposal.approximate') }}</p>
        <app-luma-button variant="secondary" size="sm" (clicked)="used.emit(p)">{{ t('location.proposal.use') }}</app-luma-button>
      </div>
    }
  `,
})
export class LocationProposal {
  private readonly places = inject(PlaceSearchRepository);
  /** The confirmed point. */
  public readonly position = input<GeoCoords | null>(null);
  public readonly used = output<AddressProposal>();
  protected readonly proposal = signal<AddressProposal | null>(null);
  private asked = '';

  constructor() {
    effect(() => {
      const at = this.position();
      untracked(() => void this.propose(at));
    });
  }

  /** "Calle 22 # 14-30" from the parts the provider gave. */
  public static addressOf(address: ApproximateAddress): string {
    if (!address.street) return '';
    return address.houseNumber ? `${address.street} # ${address.houseNumber}` : address.street;
  }

  private async propose(at: GeoCoords | null): Promise<void> {
    const key = at ? `${at.lat},${at.lng}` : '';
    if (!at || key === this.asked) return;
    this.asked = key;
    this.proposal.set(null);
    const { address } = await this.places.reverse(at);
    // Without an answer the owner simply writes the address; nothing to show.
    if (address && key === this.asked) {
      this.proposal.set({ address: LocationProposal.addressOf(address), neighborhood: address.neighbourhood ?? '' });
    }
  }
}
