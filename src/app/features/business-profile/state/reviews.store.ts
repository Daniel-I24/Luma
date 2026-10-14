import { Injectable, inject, signal } from '@angular/core';
import { ToastService } from '@design-system/toast/toast.service';
import { ReviewRepository } from '@shared/business/data/review.repository';
import type { ReviewInput, ReviewWithAuthor } from '@shared/business/models/review.model';

/**
 * ReviewsStore — reviews of the business being viewed: the latest public
 * reviews and the signed-in user's own review (loaded separately so it is
 * known even when it is not among the latest), plus writing, editing and
 * deleting that own review.
 */
@Injectable()
export class ReviewsStore {
  private readonly repo = inject(ReviewRepository);
  private readonly toasts = inject(ToastService);

  private readonly _reviews = signal<ReviewWithAuthor[]>([]);
  private readonly _ownReview = signal<ReviewWithAuthor | null>(null);
  private readonly _loading = signal(false);
  private readonly _errorKey = signal<string | null>(null);
  private readonly _saving = signal(false);
  private readonly _formErrorKey = signal<string | null>(null);

  readonly reviews = this._reviews.asReadonly();
  readonly ownReview = this._ownReview.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly errorKey = this._errorKey.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly formErrorKey = this._formErrorKey.asReadonly();

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

  /** Creates the user's review, or updates it if they already wrote one. */
  async save(businessId: string, input: ReviewInput): Promise<boolean> {
    const own = this._ownReview();
    const done = await this.run(() =>
      own ? this.repo.update(own.id, input) : this.repo.create(businessId, input),
    );
    if (done) await this.afterChange(businessId, 'reviews.saved');
    return done;
  }

  async remove(businessId: string): Promise<boolean> {
    const own = this._ownReview();
    if (!own) return false;
    const done = await this.run(() => this.repo.remove(own.id));
    if (done) await this.afterChange(businessId, 'reviews.deleted');
    return done;
  }

  private async run(request: () => Promise<{ errorKey: string | null }>): Promise<boolean> {
    this._saving.set(true);
    this._formErrorKey.set(null);
    try {
      const { errorKey } = await request();
      this._formErrorKey.set(errorKey);
      return errorKey === null;
    } finally {
      this._saving.set(false);
    }
  }

  private async afterChange(businessId: string, messageKey: string): Promise<void> {
    this.toasts.show({ messageKey, tone: 'success' });
    await this.load(businessId);
  }
}
