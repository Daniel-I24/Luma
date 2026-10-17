import type { Business, BusinessStatus } from '@shared/business/models/business.model';
import type { MenuItem } from '@shared/business/models/menu.model';

/** Moments of the day Luma IA recommends for. */
export const DAY_MOMENTS = [
  'breakfast',
  'midMorning',
  'lunch',
  'afternoon',
  'dinner',
  'night',
] as const;
export type DayMoment = (typeof DAY_MOMENTS)[number];

/** A nearby business with everything the engine may weigh. */
export interface RecommendationCandidate {
  business: Business;
  status: BusinessStatus;
  /** km from the user; null when the location is unknown. */
  distanceKm: number | null;
  /** Average rating 0–5; null without reviews. */
  rating: number | null;
  hasPromotion: boolean;
  isFavorite: boolean;
  /** Available items of its menu. */
  menu: readonly MenuItem[];
}

export interface RecommendationRequest {
  moment: DayMoment;
  candidates: readonly RecommendationCandidate[];
}

/** Why a business was picked (shown to the user as short labels). */
export type RecommendationReason = 'moment' | 'near' | 'topRated' | 'promotion' | 'favorite';

export interface RecommendedBusiness {
  candidate: RecommendationCandidate;
  score: number;
  reasons: readonly RecommendationReason[];
}

export type ComboRole = 'main' | 'side' | 'drink';

/** Main + side + drink of the same business. */
export interface Combo {
  business: Business;
  items: Readonly<Record<ComboRole, MenuItem>>;
  /** Informative total in whole COP (the server recalculates prices). */
  totalCop: number;
}

export interface Recommendation {
  /** Up to three businesses, best first. */
  businesses: readonly RecommendedBusiness[];
  /** Null when no recommended business has a valid combo. */
  combo: Combo | null;
}
