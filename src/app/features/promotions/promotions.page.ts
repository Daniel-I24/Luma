import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { Router } from '@angular/router';
import { LumaButton, LumaEmptyState, LumaIconButton, LumaSkeleton } from '@design-system';
import { PromotionCard } from '@shared/promotions/promotion-card/promotion-card';
import { PromotionFilters } from './components/promotion-filters/promotion-filters';
import { PromotionsStore } from './state/promotions.store';

/**
 * PromotionsPage — /promotions: current deals near the user, ordered by
 * distance, discount or closest end, with filters (category, minimum
 * discount, open now) and "Pedir".
 */
@Component({
  selector: 'app-promotions-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaButton,
    LumaEmptyState,
    LumaIconButton,
    LumaSkeleton,
    PromotionCard,
    PromotionFilters,
  ],
  providers: [PromotionsStore],
  templateUrl: './promotions.page.html',
  host: { class: 'block' },
})
export class PromotionsPage {
  protected readonly store = inject(PromotionsStore);
  private readonly router = inject(Router);
  protected readonly skeletons = [0, 1, 2];

  constructor() {
    void this.store.load();
  }

  protected back(): void {
    void this.router.navigate(['/feed']);
  }
}
