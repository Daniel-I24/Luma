import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaBusinessCard, LumaButton, LumaEmptyState, LumaSectionHeader, LumaSkeleton, LumaRefreshButton } from '@design-system';
import { DistancePipe } from '@shared/geo/distance';
import type { Promotion } from '@shared/business/models/business.model';
import type { NearbyBusiness } from '../../state/nearby-businesses.store';

const SKELETON_ROWS = 3;

/**
 * NearbyPanel — "Cercanos a ti" below the map: compact business cards with
 * designed loading (skeleton), error, empty and no-results states.
 */
@Component({
  selector: 'app-nearby-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LumaRefreshButton,
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
  protected readonly skeletons = Array.from({ length: SKELETON_ROWS }, (_, i) => i);
  /** Only the first cards enter one after another; the rest just appear. */
  protected readonly staggerLimit = 6;

  public readonly items = input.required<readonly NearbyBusiness[]>();
  public readonly loading = input(false);
  public readonly errorKey = input<string | null>(null);
  public readonly filtersActive = input(false);
  public readonly selectedId = input<string | null>(null);

  public readonly selectBusiness = output<NearbyBusiness>();
  public readonly retry = output<void>();
  public readonly clearFilters = output<void>();
  public readonly openAi = output<void>();

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
