/** Data of suggest-promotions. The summary comes from owner_sales_summary. */

/** Closed list: the app translates each code with the real figures below. */
export const IDEA_REASONS = ['slow_item', 'new_item', 'quiet_slot', 'top_seller'] as const;
export type IdeaReason = (typeof IDEA_REASONS)[number];

export const SLOTS = ['morning', 'midday', 'afternoon', 'evening', 'night'] as const;
export type Slot = (typeof SLOTS)[number];

export interface SummaryItem {
  readonly menu_item_id: string;
  readonly name: string;
  readonly price_cop: number;
  readonly days_listed: number;
  readonly units: number;
}

export interface SalesSummary {
  readonly orders: number;
  readonly cancel_rate: number;
  readonly items: readonly SummaryItem[];
  readonly slots: readonly { readonly dow: number; readonly slot: Slot; readonly orders: number }[];
}

/** One idea as the model (or the rules) may express it: ids, numbers and a code. */
export interface RawIdea {
  readonly menu_item_id: string;
  readonly discount_percent: number;
  readonly duration_days: number;
  readonly reason: IdeaReason;
}

/** What the owner sees: server-computed prices and the figures behind the reason. */
export interface PromotionIdea extends RawIdea {
  readonly item_name: string;
  readonly list_cop: number;
  readonly final_cop: number;
  readonly units_60d: number;
  readonly days_listed: number;
  /** Quietest moment of the week, for quiet_slot. */
  readonly slot: { readonly dow: number; readonly slot: Slot } | null;
}

export interface IdeasResponse {
  readonly source: 'ai' | 'rules';
  readonly ideas: readonly PromotionIdea[];
}

/** Below this many orders in 60 days, the rules advise (not enough data for a model). */
export const MIN_ORDERS_FOR_AI = 10;
export const MAX_IDEAS = 3;
