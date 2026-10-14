import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LumaButton, LumaEmptyState, LumaRatingStars, LumaSkeleton } from '@design-system';
import type { BusinessRating, ReviewInput } from '@shared/business/models/review.model';
import { ReviewsStore } from '../../state/reviews.store';
import { ReviewForm } from '../review-form/review-form';
import { ReviewList } from '../review-list/review-list';

/**
 * ReviewsTab — rating summary, the user's own review form (or a note for the
 * business owner, who cannot review their own business) and the latest reviews.
 */
@Component({
  selector: 'app-reviews-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    LumaButton,
    LumaEmptyState,
    LumaRatingStars,
    LumaSkeleton,
    ReviewForm,
    ReviewList,
  ],
  templateUrl: './reviews-tab.html',
  host: { class: 'block' },
})
export class ReviewsTab {
  protected readonly store = inject(ReviewsStore);
  private readonly transloco = inject(TranslocoService);

  readonly businessId = input.required<string>();
  readonly rating = input<BusinessRating | null>(null);
  readonly isOwner = input(false);

  /** Emitted after the user's review was saved or deleted. */
  readonly changed = output<void>();

  protected score(rating: BusinessRating): string {
    return rating.rating.toLocaleString(this.transloco.getActiveLang(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  protected retry(): void {
    void this.store.load(this.businessId());
  }

  protected async save(input: ReviewInput): Promise<void> {
    if (await this.store.save(this.businessId(), input)) this.changed.emit();
  }

  protected async remove(): Promise<void> {
    if (await this.store.remove(this.businessId())) this.changed.emit();
  }
}
