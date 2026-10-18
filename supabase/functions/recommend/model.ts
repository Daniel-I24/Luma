/** Data of the recommend function. Candidates come from ai_recommend_candidates. */

export const MOMENTS = ['breakfast', 'midMorning', 'lunch', 'afternoon', 'dinner', 'night'] as const;
export type Moment = (typeof MOMENTS)[number];

/** Closed list: the app translates each code; the model never writes text shown to users. */
export const REASONS = ['moment_fit', 'nearby', 'top_rated', 'deal', 'variety'] as const;
export type Reason = (typeof REASONS)[number];

export interface CandidateItem {
  readonly id: string;
  readonly name: string;
  readonly price_cop: number;
  readonly section: string | null;
}

export interface CandidatePromotion {
  readonly id: string;
  readonly menu_item_id: string | null;
  readonly discount_percent: number | null;
}

export interface Candidate {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly km: number;
  readonly rating: number | null;
  readonly promotions: readonly CandidatePromotion[];
  readonly items: readonly CandidateItem[];
}

export interface RecommendInput {
  readonly moment: Moment;
  readonly lat: number;
  readonly lng: number;
  readonly radiusKm: number;
  readonly at: string;
}

/** What the model may answer (ids and codes only). */
export interface ModelAnswer {
  readonly businesses: readonly { readonly id: string; readonly reason: Reason }[];
  readonly combo: { readonly business_id: string; readonly item_ids: readonly string[] } | null;
}

export interface ComboLine {
  readonly id: string;
  readonly name: string;
  readonly list_cop: number;
  readonly final_cop: number;
  readonly promotion_id: string | null;
}

/** The response: validated ids, server prices. */
export interface Recommendation {
  readonly businesses: readonly { readonly id: string; readonly reason: Reason }[];
  readonly combo: { readonly business_id: string; readonly items: readonly ComboLine[]; readonly total_cop: number } | null;
}
