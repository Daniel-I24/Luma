import type { Business, BusinessHours, Promotion } from '@shared/business/models/business.model';
import type { MenuItem } from '@shared/business/models/menu.model';
import { getBusinessStatus } from '@shared/business/utils/business-status.util';
import { categoryIcon } from '@shared/business/utils/category-icon.util';
import type { FeedCard } from '../models/feed-card.model';

/** At most this many dishes per business, so one menu never floods the feed. */
export const DISHES_PER_BUSINESS = 3;

export interface FeedBatch {
  /** Businesses of this batch, nearest first. */
  businesses: readonly Business[];
  hours: readonly BusinessHours[];
  promotions: readonly Promotion[];
  menuItems: readonly MenuItem[];
  /** km from the user, or null when the location is unknown. */
  distanceKm: (business: Business) => number | null;
  now?: Date;
}

/** a0, b0, a1, b1… then whatever is left of the longer list. */
export function interleave<T>(a: readonly T[], b: readonly T[]): T[] {
  const result: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) result.push(a[i]);
    if (i < b.length) result.push(b[i]);
  }
  return result;
}

/**
 * Cards of one batch in a deterministic order: promotions and dishes
 * alternate, each list following the businesses' distance order (promotions
 * ending soonest first, dishes in the owner's menu order).
 */
export function buildFeedCards(batch: FeedBatch): FeedCard[] {
  const rank = new Map(batch.businesses.map((b, i) => [b.id, i]));
  const byRank = (a: { business_id: string }, b: { business_id: string }) =>
    (rank.get(a.business_id) ?? 0) - (rank.get(b.business_id) ?? 0);

  const promotions = batch.promotions
    .filter((p) => rank.has(p.business_id))
    .sort((a, b) => byRank(a, b) || a.ends_at.localeCompare(b.ends_at) || a.id.localeCompare(b.id));
  const dishes = topDishes(batch.menuItems.filter((m) => rank.has(m.business_id))).sort(
    (a, b) => byRank(a, b) || a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  );

  const context = cardContext(batch);
  return interleave<FeedCard>(
    promotions.map((p) => ({
      ...context(p.business_id),
      id: `promotion:${p.id}`,
      kind: 'promotion',
      title: p.title,
      description: p.description,
      imageUrl: p.image_url,
      priceCop: null,
      validUntil: p.ends_at,
      menuItem: null,
    })),
    dishes.map((m) => ({
      ...context(m.business_id),
      id: `dish:${m.id}`,
      kind: 'dish',
      title: m.name,
      description: m.description,
      imageUrl: m.image_url,
      priceCop: m.price_cop,
      validUntil: null,
      menuItem: m,
    })),
  );
}

/** First DISHES_PER_BUSINESS available items of each business, by menu order. */
function topDishes(items: readonly MenuItem[]): MenuItem[] {
  const count = new Map<string, number>();
  return [...items]
    .filter((m) => m.is_available)
    .sort((a, b) => a.sort_order - b.sort_order)
    .filter((m) => {
      const seen = count.get(m.business_id) ?? 0;
      count.set(m.business_id, seen + 1);
      return seen < DISHES_PER_BUSINESS;
    });
}

function cardContext(batch: FeedBatch) {
  const businesses = new Map(batch.businesses.map((b) => [b.id, b]));
  return (businessId: string) => {
    const business = businesses.get(businessId) as Business;
    const hours = batch.hours.filter((h) => h.business_id === businessId);
    return {
      business,
      status: getBusinessStatus(hours, batch.now),
      distanceKm: batch.distanceKm(business),
      icon: categoryIcon(business.category),
    };
  };
}
