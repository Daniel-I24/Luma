/** Review — mirrors the public.reviews table row (one per user and business). */
export interface Review {
  id: string;
  business_id: string;
  user_id: string;
  /** Whole stars, 1 to 5. */
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * ReviewWithAuthor — row of the public.reviews_with_author view: the review
 * plus the author's optional display name (never their email).
 */
export interface ReviewWithAuthor extends Review {
  display_name: string | null;
}

/** Average rating (one decimal) and number of reviews of a business. */
export interface BusinessRating {
  businessId: string;
  rating: number;
  reviewCount: number;
}

/** What a user can write in a review. */
export interface ReviewInput {
  rating: number;
  comment: string | null;
}
