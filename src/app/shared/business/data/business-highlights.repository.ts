import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { Promotion } from '../models/business.model';
import type { BusinessRating } from '../models/review.model';
import type { RepoResult } from './business.repository';

interface BusinessRatingRow {
  business_id: string;
  /** numeric in Postgres: may arrive as a number or a string. */
  average_rating: number | string;
  review_count: number;
}

/**
 * BusinessHighlightsRepository — data shown for many businesses at once
 * (map cards): one query for all their promotions, one for all their
 * ratings, never one request per business.
 */
@Injectable({ providedIn: 'root' })
export class BusinessHighlightsRepository {
  private readonly db = inject(SupabaseService).client;

  /** Active, time-valid promotions of the given businesses. */
  async getActivePromotions(businessIds: readonly string[]): Promise<RepoResult<Promotion[]>> {
    if (businessIds.length === 0) return { data: [], errorKey: null };
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from('promotions')
      .select('*')
      .in('business_id', [...businessIds])
      .eq('is_active', true)
      .lte('starts_at', now)
      .gte('ends_at', now);

    if (error) return { data: null, errorKey: 'businesses.errors.promotionsFailed' };
    return { data: data as Promotion[], errorKey: null };
  }

  /** Ratings by business id; businesses without reviews are absent. */
  async getRatings(
    businessIds: readonly string[],
  ): Promise<RepoResult<Map<string, BusinessRating>>> {
    if (businessIds.length === 0) return { data: new Map(), errorKey: null };
    const { data, error } = await this.db
      .from('business_ratings')
      .select('business_id, average_rating, review_count')
      .in('business_id', [...businessIds]);

    if (error) return { data: null, errorKey: 'businesses.errors.ratingsFailed' };
    const ratings = (data as BusinessRatingRow[]).map((row) => toRating(row));
    return { data: new Map(ratings.map((r) => [r.businessId, r])), errorKey: null };
  }
}

function toRating(row: BusinessRatingRow): BusinessRating {
  return {
    businessId: row.business_id,
    rating: Number(row.average_rating),
    reviewCount: row.review_count,
  };
}
