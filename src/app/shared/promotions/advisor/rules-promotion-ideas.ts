import { promotionPrice } from '../promotion-deal';
import type { PromotionIdea, SalesSummary } from './promotion-idea';

const MAX_IDEAS = 3;

/**
 * Rules advisor, the same rules as suggest-promotions applies below 10
 * orders (supabase/functions/suggest-promotions/ideas.ts): items without
 * sales for more than 14 days (15 %), recent items with few sales (10 %),
 * and the best seller at the week's quietest moment (10 %), 7 days each.
 * Never an item with a running promotion.
 */
export function ruleIdeas(summary: SalesSummary, promoted: ReadonlySet<string>): PromotionIdea[] {
  const free = summary.items.filter((item) => !promoted.has(item.menu_item_id));
  const quiet = [...summary.slots].sort((a, b) => a.orders - b.orders || a.dow - b.dow)[0] ?? null;
  const ideas: PromotionIdea[] = [];
  const add = (
    item: SalesSummary['items'][number] | undefined,
    percent: number,
    reason: PromotionIdea['reason'],
  ) => {
    if (!item || ideas.some((idea) => idea.menu_item_id === item.menu_item_id)) return;
    ideas.push({
      menu_item_id: item.menu_item_id,
      item_name: item.name,
      discount_percent: percent,
      duration_days: 7,
      reason,
      list_cop: item.price_cop,
      final_cop: promotionPrice(item.price_cop, percent),
      units_60d: item.units,
      days_listed: item.days_listed,
      slot: reason === 'quiet_slot' && quiet ? { dow: quiet.dow, slot: quiet.slot } : null,
    });
  };
  for (const item of free.filter((i) => i.units === 0 && i.days_listed > 14))
    add(item, 15, 'slow_item');
  for (const item of free.filter((i) => i.days_listed <= 14 && i.units <= 2))
    add(item, 10, 'new_item');
  const best = [...free].sort((a, b) => b.units - a.units)[0];
  if (best && best.units > 0 && quiet) add(best, 10, 'quiet_slot');
  return ideas.slice(0, MAX_IDEAS);
}
