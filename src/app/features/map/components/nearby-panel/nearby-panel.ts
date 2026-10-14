import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  LumaBusinessCard,
  LumaButton,
  LumaEmptyState,
  LumaSectionHeader,
  LumaSkeleton,
} from '@design-system';
import { DistancePipe } from '@shared/geo/distance.pipe';
import type { NearbyBusiness } from '../../state/nearby-businesses.store';

/**
 * NearbyPanel — "Cercanos a ti" below the map: compact business cards with
 * designed loading (skeleton), error, empty and no-results states.
 */
@Component({
  selector: 'app-nearby-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaBusinessCard,
    LumaButton,
    LumaEmptyState,
    LumaSectionHeader,
    LumaSkeleton,
    DistancePipe,
  ],
  templateUrl: './nearby-panel.html',
  host: { class: 'block' },
})
export class NearbyPanel {
  private readonly transloco = inject(TranslocoService);
  protected readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  protected readonly skeletons = [0, 1, 2];

  readonly items = input.required<readonly NearbyBusiness[]>();
  readonly loading = input(false);
  readonly errorKey = input<string | null>(null);
  readonly filtersActive = input(false);
  readonly selectedId = input<string | null>(null);

  readonly selectBusiness = output<NearbyBusiness>();
  readonly retry = output<void>();
  readonly clearFilters = output<void>();
  readonly openAi = output<void>();
}
