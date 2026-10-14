/** Average rating (0–5) and number of reviews of a business. */
export interface BusinessRating {
  rating: number;
  reviewCount: number;
}

/**
 * BusinessRatingProvider — source of business ratings. The backend has no
 * reviews yet, so the app is wired to a mock (see docs/mocks.md); swapping
 * it for a real repository only changes the provider in app.config.ts.
 */
export abstract class BusinessRatingProvider {
  /** Rating of the business, or null when it has no reviews. */
  abstract getRating(businessId: string): BusinessRating | null;
}
