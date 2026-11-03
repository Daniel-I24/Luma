import type { NearbyBusiness } from '../state/nearby-businesses.store';

/** Distance limits offered in the filters sheet, in km. */
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- data table: distance choices in km
export const DISTANCE_OPTIONS = [1, 3, 5, 10] as const;
export type DistanceOption = (typeof DISTANCE_OPTIONS)[number];
/** "Calificación de 4 o más". */
const MIN_GOOD_RATING = 4;

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

/** MapFilters — applies and counts the map filters. */
export class MapFilterRules {
  /** How many filters are on (each selected category counts once). */
  public static activeFilterCount(filters: MapFilters): number {
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
  public static applyMapFilters(
    items: readonly NearbyBusiness[],
    filters: MapFilters,
  ): NearbyBusiness[] {
    return items.filter((item) => MapFilterRules.passes(item, filters));
  }

  /** True when one business passes every active filter. */
  public static passes(item: NearbyBusiness, filters: MapFilters): boolean {
    return MapFilterRules.passesFlags(item, filters) && MapFilterRules.withinDistance(item, filters) &&
      (!filters.categories.length || filters.categories.includes(item.business.category.trim()));
  }

  private static passesFlags(item: NearbyBusiness, filters: MapFilters): boolean {
    return (
      (!filters.openNow || item.status === 'open' || item.status === 'closing-soon') &&
      (!filters.withPromotion || item.promotion !== null) &&
      (!filters.goodRating || (item.rating?.rating ?? 0) >= MIN_GOOD_RATING)
    );
  }

  private static withinDistance(item: NearbyBusiness, filters: MapFilters): boolean {
    return filters.maxDistanceKm === null || item.distanceKm === null || item.distanceKm <= filters.maxDistanceKm;
  }

  /** Adds or removes a category from the selection. */
  public static toggleCategory(filters: MapFilters, category: string): MapFilters {
    const categories = filters.categories.includes(category)
      ? filters.categories.filter((c) => c !== category)
      : [...filters.categories, category];
    return { ...filters, categories };
  }
}

