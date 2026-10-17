import { describe, expect, it } from 'vitest';
import type { Business, BusinessStatus, Promotion } from '@shared/business/models/business.model';
import type { NearbyBusiness } from '../state/nearby-businesses.store';
import { NO_FILTERS, activeFilterCount, applyMapFilters, toggleCategory } from './map-filters.util';

const item = (
  id: string,
  extra: {
    status?: BusinessStatus;
    rating?: number;
    promo?: boolean;
    km?: number | null;
    category?: string;
  },
): NearbyBusiness => ({
  business: { id, category: extra.category ?? 'Café' } as Business,
  status: extra.status ?? 'open',
  distanceKm: extra.km === undefined ? 2 : extra.km,
  rating:
    extra.rating === undefined ? null : { businessId: id, rating: extra.rating, reviewCount: 3 },
  ratingsLoaded: true,
  promotion: extra.promo ? ({ id: 'p' } as Promotion) : null,
  logoIcon: 'store',
});

const items = [
  item('a', { status: 'open', rating: 4.5, promo: true, km: 0.8, category: 'Café' }),
  item('b', { status: 'closing-soon', rating: 3.9, km: 4, category: 'Bar' }),
  item('c', { status: 'closed', rating: 4, promo: true, km: 9, category: 'Bar' }),
  item('d', { status: 'opening-soon', km: null, category: 'Tienda' }),
];
const ids = (list: NearbyBusiness[]) => list.map((i) => i.business.id);

describe('map filters', () => {
  it('keeps everything without filters', () => {
    expect(ids(applyMapFilters(items, NO_FILTERS))).toEqual(['a', 'b', 'c', 'd']);
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
  });

  it('filters open now (closing soon counts), promotions and 4+ ratings', () => {
    expect(ids(applyMapFilters(items, { ...NO_FILTERS, openNow: true }))).toEqual(['a', 'b']);
    expect(ids(applyMapFilters(items, { ...NO_FILTERS, withPromotion: true }))).toEqual(['a', 'c']);
    expect(ids(applyMapFilters(items, { ...NO_FILTERS, goodRating: true }))).toEqual(['a', 'c']);
  });

  it('filters by distance, ignoring it when the distance is unknown', () => {
    expect(ids(applyMapFilters(items, { ...NO_FILTERS, maxDistanceKm: 5 }))).toEqual([
      'a',
      'b',
      'd',
    ]);
    expect(ids(applyMapFilters(items, { ...NO_FILTERS, maxDistanceKm: 1 }))).toEqual(['a', 'd']);
  });

  it('filters by several categories and combines every filter', () => {
    const bars = toggleCategory(toggleCategory(NO_FILTERS, 'Bar'), 'Tienda');
    expect(ids(applyMapFilters(items, bars))).toEqual(['b', 'c', 'd']);
    expect(ids(applyMapFilters(items, { ...bars, openNow: true }))).toEqual(['b']);
    expect(toggleCategory(bars, 'Bar').categories).toEqual(['Tienda']);
  });

  it('counts each active filter and category', () => {
    expect(
      activeFilterCount({
        openNow: true,
        withPromotion: true,
        goodRating: false,
        maxDistanceKm: 3,
        categories: ['Bar', 'Café'],
      }),
    ).toBe(5);
  });
});
