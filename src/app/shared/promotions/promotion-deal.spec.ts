import { describe, expect, it } from 'vitest';
import { arrangeDeals, NO_DEAL_FILTERS } from './deal-list.util';
import { type PromotionDeal, endsIn, promotionPrice } from './promotion-deal';
import type { DealWithHours } from './promotion-deal.repository';

const open24 = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day_of_week: day,
  opens_at: '00:00:00',
  closes_at: '23:59:00',
  is_closed: false,
})) as DealWithHours['hours'];

function deal(
  id: string,
  patch: Partial<PromotionDeal> & { lat?: number; category?: string },
): DealWithHours {
  const { lat = 1.21, category = 'Bar', ...rest } = patch;
  return {
    hours: id === 'closed' ? [] : open24,
    deal: {
      id,
      title: id,
      description: null,
      imageUrl: null,
      startsAt: '2026-10-01T00:00:00Z',
      endsAt: '2026-10-30T00:00:00Z',
      discountPercent: null,
      item: null,
      business: { id: `b-${id}`, name: id, category, latitude: lat, longitude: -77.28 },
      ...rest,
    },
  };
}

describe('promotionPrice', () => {
  it('rounds to the nearest peso with halves up, like the database', () => {
    expect(promotionPrice(9990, 15)).toBe(8492);
    expect(promotionPrice(1001, 50)).toBe(501);
    expect(promotionPrice(2000, null)).toBe(2000);
  });
});

describe('endsIn', () => {
  // 2026-10-18 21:00 in Bogota.
  const now = new Date('2026-10-19T02:00:00Z');

  it('counts days in Colombia', () => {
    expect(endsIn('2026-10-19T04:00:00Z', now)).toEqual({ key: 'endsToday' });
    expect(endsIn('2026-10-19T15:00:00Z', now)).toEqual({ key: 'endsTomorrow' });
    expect(endsIn('2026-10-21T15:00:00Z', now)).toEqual({ key: 'endsInDays', days: 3 });
  });
});

describe('arrangeDeals', () => {
  const origin = { lat: 1.21, lng: -77.28 };
  const now = new Date('2026-10-18T17:00:00Z');
  const deals = [
    deal('far', { lat: 1.3, discountPercent: 50, endsAt: '2026-10-25T00:00:00Z' }),
    deal('near', { discountPercent: 10, endsAt: '2026-10-28T00:00:00Z', category: 'Restaurante' }),
    deal('closed', { lat: 1.22, endsAt: '2026-10-20T00:00:00Z' }),
  ];
  const ids = (sort: 'distance' | 'discount' | 'ending', filters = NO_DEAL_FILTERS) =>
    arrangeDeals(deals, { sort, filters, origin, now }).map((d) => d.deal.id);

  it('sorts by distance, discount or closest end', () => {
    expect(ids('distance')).toEqual(['near', 'closed', 'far']);
    expect(ids('discount')).toEqual(['far', 'near', 'closed']);
    expect(ids('ending')).toEqual(['closed', 'far', 'near']);
  });

  it('filters by category, minimum discount and open now', () => {
    expect(ids('distance', { ...NO_DEAL_FILTERS, category: 'Restaurante' })).toEqual(['near']);
    expect(ids('distance', { ...NO_DEAL_FILTERS, minDiscount: 20 })).toEqual(['far']);
    expect(ids('distance', { ...NO_DEAL_FILTERS, openNow: true })).toEqual(['near', 'far']);
  });
});
