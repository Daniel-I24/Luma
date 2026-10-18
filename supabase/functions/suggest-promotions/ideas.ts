import { promotionPrice } from '../_shared/edge.ts';
import {
  MAX_IDEAS,
  type PromotionIdea,
  type RawIdea,
  type SalesSummary,
  type Slot,
} from './model.ts';

/** The week's quietest observed moment (fewest orders), or null without data. */
export function quietestSlot(summary: SalesSummary): { dow: number; slot: Slot } | null {
  const sorted = [...summary.slots].sort((a, b) => a.orders - b.orders || a.dow - b.dow);
  return sorted[0] ? { dow: sorted[0].dow, slot: sorted[0].slot } : null;
}

/**
 * Rules advisor (also mirrored in the app for aiMode "rules"): items without
 * sales, recently added items with few sales, and the best seller at the
 * quietest moment. Never an item that already has a running promotion.
 */
export function ruleIdeas(summary: SalesSummary, promoted: ReadonlySet<string>): RawIdea[] {
  const free = summary.items.filter((item) => !promoted.has(item.menu_item_id));
  const ideas: RawIdea[] = [];
  const add = (id: string | undefined, percent: number, reason: RawIdea['reason']) => {
    if (id && !ideas.some((idea) => idea.menu_item_id === id)) {
      ideas.push({ menu_item_id: id, discount_percent: percent, duration_days: 7, reason });
    }
  };
  for (const item of free.filter((i) => i.units === 0 && i.days_listed > 14)) add(item.menu_item_id, 15, 'slow_item');
  for (const item of free.filter((i) => i.days_listed <= 14 && i.units <= 2)) add(item.menu_item_id, 10, 'new_item');
  const best = [...free].sort((a, b) => b.units - a.units)[0];
  if (best && best.units > 0 && quietestSlot(summary)) add(best.menu_item_id, 10, 'quiet_slot');
  return ideas.slice(0, MAX_IDEAS);
}

/**
 * Keeps valid ideas only (items of the summary, no running promotion, no
 * repeats, at most 3) and adds the server prices and figures.
 */
export function finalizeIdeas(
  raw: readonly RawIdea[],
  summary: SalesSummary,
  promoted: ReadonlySet<string>,
): PromotionIdea[] {
  const slot = quietestSlot(summary);
  const seen = new Set<string>();
  return raw.flatMap((idea) => {
    const item = summary.items.find((i) => i.menu_item_id === idea.menu_item_id);
    if (!item || promoted.has(item.menu_item_id) || seen.has(item.menu_item_id)) return [];
    seen.add(item.menu_item_id);
    return [{
      ...idea,
      item_name: item.name,
      list_cop: item.price_cop,
      final_cop: promotionPrice(item.price_cop, idea.discount_percent),
      units_60d: item.units,
      days_listed: item.days_listed,
      slot: idea.reason === 'quiet_slot' ? slot : null,
    }];
  }).slice(0, MAX_IDEAS);
}
