import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LumaEmptyState } from '@design-system';
import { PromotionCard } from '@shared/promotions/promotion-card/promotion-card';
import type { PromotionDeal } from '@shared/promotions/promotion-deal';

/** PromosTab — current promotions of the business, with the same card as /promotions. */
@Component({
  selector: 'app-promos-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, RouterLink, LumaEmptyState, PromotionCard],
  templateUrl: './promos-tab.html',
  host: { class: 'block' },
})
export class PromosTab {
  readonly promotions = input.required<readonly PromotionDeal[]>();
  /** Id of the deal Luma IA recommends for this moment, if any. */
  readonly recommendedId = input<string | null>(null);
}
