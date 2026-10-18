import * as z from 'zod/mini';

/** Reason codes of an idea; the app translates them with the figures below. */
export const IDEA_REASONS = ['slow_item', 'new_item', 'quiet_slot', 'top_seller'] as const;
export type IdeaReason = (typeof IDEA_REASONS)[number];
export const IDEA_SLOTS = ['morning', 'midday', 'afternoon', 'evening', 'night'] as const;

const slotSchema = z.object({ dow: z.number(), slot: z.enum(IDEA_SLOTS) });

/** One idea, as suggest-promotions answers it (server prices). */
export const ideaSchema = z.object({
  menu_item_id: z.string(),
  item_name: z.string(),
  discount_percent: z.number(),
  duration_days: z.number(),
  reason: z.enum(IDEA_REASONS),
  list_cop: z.number(),
  final_cop: z.number(),
  units_60d: z.number(),
  days_listed: z.number(),
  slot: z.nullable(slotSchema),
});
export type PromotionIdea = z.infer<typeof ideaSchema>;

export const ideasResultSchema = z.object({
  source: z.enum(['ai', 'rules']),
  ideas: z.array(ideaSchema),
});
export type IdeasResult = z.infer<typeof ideasResultSchema>;

/** owner_sales_summary (aggregates of the last 60 days). */
export const salesSummarySchema = z.object({
  orders: z.number(),
  cancel_rate: z.number(),
  items: z.array(
    z.object({
      menu_item_id: z.string(),
      name: z.string(),
      price_cop: z.number(),
      days_listed: z.number(),
      units: z.number(),
    }),
  ),
  slots: z.array(z.object({ dow: z.number(), slot: z.enum(IDEA_SLOTS), orders: z.number() })),
});
export type SalesSummary = z.infer<typeof salesSummarySchema>;
