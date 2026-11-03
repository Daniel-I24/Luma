import { OpeningHours } from '@shared/business/domain/opening-hours';
import type { GeoCoords } from '@shared/geo/geolocation.service';
import { Haversine } from '@shared/geo/haversine';
import type { PromotionDeal } from './promotion-deal';
import type { DealWithHours } from './promotion-deal.repository';

export const DEAL_SORTS = ['distance', 'discount', 'ending'] as const;
export type DealSort = (typeof DEAL_SORTS)[number];

/** Minimum discounts offered by the filter (0 = any, text-only promotions too). */
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- data table: minimum-discount choices
export const MIN_DISCOUNTS = [0, 10, 20, 30, 50] as const;

export interface DealFilters {
  readonly category: string | null;
  readonly minDiscount: number;
  readonly openNow: boolean;
}

export const NO_DEAL_FILTERS: DealFilters = { category: null, minDiscount: 0, openNow: false };

export interface ListedDeal {
  readonly deal: PromotionDeal;
  readonly distanceKm: number;
  readonly open: boolean;
}

/** DealList — sorts and filters the promotions list. */
export class DealList {
  /** Filters and orders the deals: by distance, by discount or by the closest end. */
  public static arrangeDeals(
    deals: readonly DealWithHours[],
    options: { sort: DealSort; filters: DealFilters; origin: GeoCoords; now: Date },
  ): ListedDeal[] {
    const { sort, filters, origin, now } = options;
    const listed = deals.map(({ deal, hours }) => ({
      deal,
      distanceKm: Haversine.haversineKm(
        origin.lat,
        origin.lng,
        deal.business.latitude,
        deal.business.longitude,
      ),
      open: OpeningHours.from(hours).isOpenAt(now),
    }));
    const kept = listed.filter(
      ({ deal, open }) =>
        (!filters.category || deal.business.category === filters.category) &&
        (deal.discountPercent ?? 0) >= filters.minDiscount &&
        (!filters.openNow || open),
    );
    const byDistance = (a: ListedDeal, b: ListedDeal): number => a.distanceKm - b.distanceKm;
    const compare: Record<DealSort, (a: ListedDeal, b: ListedDeal) => number> = {
      distance: byDistance,
      discount: (a, b) =>
        (b.deal.discountPercent ?? 0) - (a.deal.discountPercent ?? 0) || byDistance(a, b),
      ending: (a, b) => Date.parse(a.deal.endsAt) - Date.parse(b.deal.endsAt) || byDistance(a, b),
    };
    return kept.sort(compare[sort]);
  }
}

