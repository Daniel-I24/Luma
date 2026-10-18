import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  LumaBusinessCard,
  LumaButton,
  LumaEmptyState,
  LumaSectionHeader,
  LumaSkeleton,
} from '@design-system';
import { DistancePipe } from '@shared/geo/distance.pipe';
import type { Promotion } from '@shared/business/models/business.model';
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
  private readonly router = inject(Router);
  protected readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  protected readonly skeletons = [0, 1, 2];
  /** Only the first cards enter one after another; the rest just appear. */
  protected readonly staggerLimit = 6;

  readonly items = input.required<readonly NearbyBusiness[]>();
  readonly loading = input(false);
  readonly errorKey = input<string | null>(null);
  readonly filtersActive = input(false);
  readonly selectedId = input<string | null>(null);

  readonly selectBusiness = output<NearbyBusiness>();
  readonly retry = output<void>();
  readonly clearFilters = output<void>();
  readonly openAi = output<void>();

  /** "-25 % · Title" for discounts, the title otherwise. */
  protected promoLabel(promotion: Promotion): string {
    if (!promotion.menu_item_id || promotion.discount_percent === null) return promotion.title;
    const off = this.transloco.translate('promotions.card.discount', {
      percent: promotion.discount_percent,
    });
    return `${off} · ${promotion.title}`;
  }

  protected openPromotions(): void {
    void this.router.navigate(['/promotions']);
  }
}
