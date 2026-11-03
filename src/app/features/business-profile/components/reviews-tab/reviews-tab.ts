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
  template: `
    <div *transloco="let t" class="flex flex-col gap-4 p-4" [attr.aria-busy]="store.loading()">
      @if (rating(); as r) {
      <div class="flex items-center gap-3">
        <span class="text-display text-fg">{{ score(r) }}</span>
        <div class="flex flex-col gap-1">
          <app-luma-rating-stars variant="stars" [rating]="r.rating" [reviewCount]="r.reviewCount" />
          <span class="text-caption text-fg-subtle">
            {{ t('rating.reviews', { count: r.reviewCount }) }}
          </span>
        </div>
      </div>
      } @if (isOwner()) {
      <p class="m-0 rounded-md bg-surface-selected p-3 text-body-sm text-fg-muted" role="note">
        {{ t('reviews.form.ownerNote') }}
      </p>
      } @else if (!store.loading() && !store.errorKey()) {
      <app-review-form
        [existing]="store.ownReview()"
        [saving]="store.saving()"
        [errorKey]="store.formErrorKey()"
        (submitted)="save($event)"
        (deleted)="remove()"
      />
      } @if (store.loading()) {
      <app-luma-skeleton class="h-24 w-full" shape="rect" />
      <app-luma-skeleton class="h-24 w-full" shape="rect" />
      } @else if (store.errorKey(); as key) {
      <app-luma-empty-state
        icon="alert"
        tone="error"
        [heading]="t('businessProfile.reviews.errorTitle')"
        [description]="t(key)"
      >
        <app-luma-button (clicked)="retry()">{{ t('common.retry') }}</app-luma-button>
      </app-luma-empty-state>
      } @else if (store.reviews().length === 0) {
      <app-luma-empty-state
        icon="star"
        [heading]="t('rating.none')"
        [description]="t('businessProfile.reviews.emptyDescription')"
      />
      } @else {
      <app-review-list [reviews]="store.reviews()" />
      }
    </div>
  `,
  host: { class: 'block' },
})
export class ReviewsTab {
  protected readonly store = inject(ReviewsStore);
  private readonly transloco = inject(TranslocoService);

  public readonly businessId = input.required<string>();
  public readonly rating = input<BusinessRating | null>(null);
  public readonly isOwner = input(false);

  /** Emitted after the user's review was saved or deleted. */
  public readonly changed = output<void>();

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
