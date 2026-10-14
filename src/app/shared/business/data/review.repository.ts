import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { Review, ReviewInput, ReviewWithAuthor } from '../models/review.model';
import type { RepoResult } from './business.repository';
import { reviewInputSchema } from './review.schema';

const DEFAULT_PAGE_SIZE = 20;

/**
 * ReviewRepository — public reviews of a business and the user's own
 * review. Inputs are validated before reaching the database; RLS ensures
 * users only write their own reviews and never review their own business.
 */
@Injectable({ providedIn: 'root' })
export class ReviewRepository {
  private readonly db = inject(SupabaseService).client;

  /** Latest reviews of a business with the author's display name. */
  async getReviews(
    businessId: string,
    limit = DEFAULT_PAGE_SIZE,
  ): Promise<RepoResult<ReviewWithAuthor[]>> {
    const { data, error } = await this.db
      .from('reviews_with_author')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return { data: null, errorKey: 'businesses.errors.reviewsFailed' };
    return { data: data as ReviewWithAuthor[], errorKey: null };
  }

  async create(businessId: string, input: ReviewInput): Promise<RepoResult<Review>> {
    const parsed = reviewInputSchema.safeParse(input);
    if (!parsed.success) return { data: null, errorKey: parsed.error.issues[0].message };

    const { data, error } = await this.db
      .from('reviews')
      .insert({ business_id: businessId, ...parsed.data })
      .select('*')
      .maybeSingle();

    if (error || !data) return { data: null, errorKey: 'businesses.errors.reviewSaveFailed' };
    return { data: data as Review, errorKey: null };
  }

  async update(reviewId: string, input: ReviewInput): Promise<RepoResult<Review>> {
    const parsed = reviewInputSchema.safeParse(input);
    if (!parsed.success) return { data: null, errorKey: parsed.error.issues[0].message };

    const { data, error } = await this.db
      .from('reviews')
      .update(parsed.data)
      .eq('id', reviewId)
      .select('*')
      .maybeSingle();

    if (error || !data) return { data: null, errorKey: 'businesses.errors.reviewSaveFailed' };
    return { data: data as Review, errorKey: null };
  }

  async remove(reviewId: string): Promise<RepoResult<true>> {
    const { error } = await this.db.from('reviews').delete().eq('id', reviewId);
    if (error) return { data: null, errorKey: 'businesses.errors.reviewDeleteFailed' };
    return { data: true, errorKey: null };
  }
}
