import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaButton, LumaEmptyState, LumaRatingStars, LumaSkeleton } from '@design-system';
import type { BusinessRating } from '@shared/business/models/review.model';
import { ReviewsStore } from '../../state/reviews.store';
import { ReviewList } from '../review-list/review-list';

/** ReviewsTab — rating summary and the latest reviews of the business. */
@Component({
  selector: 'app-reviews-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, LumaButton, LumaEmptyState, LumaRatingStars, LumaSkeleton, ReviewList],
  templateUrl: './reviews-tab.html',
  host: { class: 'block' },
})
export class ReviewsTab {
  protected readonly store = inject(ReviewsStore);
  private readonly transloco = inject(TranslocoService);

  readonly businessId = input.required<string>();
  readonly rating = input<BusinessRating | null>(null);

  protected score(rating: BusinessRating): string {
    return rating.rating.toLocaleString(this.transloco.getActiveLang(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  protected retry(): void {
    void this.store.load(this.businessId());
  }
}
