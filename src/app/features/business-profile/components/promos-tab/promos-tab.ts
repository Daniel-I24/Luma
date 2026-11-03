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
  template: `
    <ng-container *transloco="let t">
      @if (promotions().length === 0) {
      <app-luma-empty-state
        icon="tag"
        [heading]="t('businessProfile.promos.emptyTitle')"
        [description]="t('businessProfile.promos.emptyDescription')"
      />
      } @else {
      <ul class="m-0 flex list-none flex-col gap-3 p-4">
        @for (deal of promotions(); track deal.id) {
        <li>
          <app-promotion-card
            [deal]="deal"
            [showBusiness]="false"
            [recommended]="deal.id === recommendedId()"
          />
        </li>
        }
      </ul>
      }
      <a
        class="mx-4 mb-4 inline-flex min-h-11 items-center text-body-sm font-semibold text-fg-brand"
        routerLink="/promotions"
        >{{ t('promotions.seeAll') }}</a
      >
    </ng-container>
  `,
  host: { class: 'block' },
})
export class PromosTab {
  public readonly promotions = input.required<readonly PromotionDeal[]>();
  /** Id of the deal Luma IA recommends for this moment, if any. */
  public readonly recommendedId = input<string | null>(null);
}
