import type { NearbyBusiness } from '../state/nearby-businesses.store';

/** Distance limits offered in the filters sheet, in km. */
export const DISTANCE_OPTIONS = [1, 3, 5, 10] as const;
export type DistanceOption = (typeof DISTANCE_OPTIONS)[number];
/** "Calificación de 4 o más". */
export const MIN_GOOD_RATING = 4;

export interface MapFilters {
  readonly openNow: boolean;
  readonly withPromotion: boolean;
  readonly goodRating: boolean;
  readonly maxDistanceKm: DistanceOption | null;
  readonly categories: readonly string[];
}

export const NO_FILTERS: MapFilters = {
  openNow: false,
  withPromotion: false,
  goodRating: false,
  maxDistanceKm: null,
  categories: [],
};

/** How many filters are on (each selected category counts once). */
export function activeFilterCount(filters: MapFilters): number {
  return (
    Number(filters.openNow) +
    Number(filters.withPromotion) +
    Number(filters.goodRating) +
    Number(filters.maxDistanceKm !== null) +
    filters.categories.length
  );
}

/**
 * Applies the sheet filters to the businesses already loaded (client side).
 * Without a known location the distance filter cannot be evaluated and is
 * ignored (the sheet disables it).
 */
export function applyMapFilters(
  items: readonly NearbyBusiness[],
  filters: MapFilters,
): NearbyBusiness[] {
  return items.filter((item) => {
    if (filters.openNow && item.status !== 'open' && item.status !== 'closing-soon') return false;
    if (filters.withPromotion && item.promotion === null) return false;
    if (filters.goodRating && (item.rating?.rating ?? 0) < MIN_GOOD_RATING) return false;
    if (
      filters.maxDistanceKm !== null &&
      item.distanceKm !== null &&
      item.distanceKm > filters.maxDistanceKm
    ) {
      return false;
    }
    if (filters.categories.length && !filters.categories.includes(item.business.category.trim())) {
      return false;
    }
    return true;
  });
}

/** Adds or removes a category from the selection. */
export function toggleCategory(filters: MapFilters, category: string): MapFilters {
  const categories = filters.categories.includes(category)
    ? filters.categories.filter((c) => c !== category)
    : [...filters.categories, category];
  return { ...filters, categories };
}
