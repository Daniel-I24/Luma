import { Injectable, inject, signal } from '@angular/core';
import { ReviewRepository } from '@shared/business/data/review.repository';
import type { ReviewWithAuthor } from '@shared/business/models/review.model';

/**
 * ReviewsStore — reviews of the business being viewed: the latest public
 * reviews and the signed-in user's own review (loaded separately so it is
 * known even when it is not among the latest).
 */
@Injectable()
export class ReviewsStore {
  private readonly repo = inject(ReviewRepository);

  private readonly _reviews = signal<ReviewWithAuthor[]>([]);
  private readonly _ownReview = signal<ReviewWithAuthor | null>(null);
  private readonly _loading = signal(false);
  private readonly _errorKey = signal<string | null>(null);

  readonly reviews = this._reviews.asReadonly();
  readonly ownReview = this._ownReview.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly errorKey = this._errorKey.asReadonly();

  async load(businessId: string): Promise<void> {
    this._loading.set(true);
    this._errorKey.set(null);
    const [list, own] = await Promise.all([
      this.repo.getReviews(businessId),
      this.repo.getOwnReview(businessId),
    ]);
    this._loading.set(false);
    if (list.errorKey || !list.data) {
      this._errorKey.set(list.errorKey ?? 'businesses.errors.reviewsFailed');
      return;
    }
    this._reviews.set(list.data);
    this._ownReview.set(own.data);
  }
}
