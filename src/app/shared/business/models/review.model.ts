/**
 * Review — the columns of public.reviews clients can read (one review per
 * user and business). The author's user_id is never readable by clients.
 */
export interface Review {
  id: string;
  business_id: string;
  /** Whole stars, 1 to 5. */
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * ReviewWithAuthor — row of the public.reviews_with_author view: the review
 * plus the author's optional display name. Never the author's id or email;
 * `is_mine` tells whether the signed-in user wrote it.
 */
export interface ReviewWithAuthor extends Review {
  display_name: string | null;
  is_mine: boolean;
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
