import { describe, expect, it } from 'vitest';
import type { Business, BusinessHours, Promotion } from '@shared/business/models/business.model';
import type { MenuItem } from '@shared/business/models/menu.model';
import { DISHES_PER_BUSINESS, buildFeedCards, interleave } from './feed-cards.util';

const business = (id: string, category = 'Restaurante') => ({ id, name: id, category }) as Business;
const promo = (id: string, business_id: string, ends_at: string) =>
  ({ id, business_id, title: id, description: null, image_url: null, ends_at }) as Promotion;
const dish = (id: string, business_id: string, sort_order: number, is_available = true) =>
  ({ id, business_id, name: id, description: null, image_url: null, price_cop: 1000, sort_order, is_available }) as MenuItem;

const near = business('near', 'Cafetería');
const far = business('far');

function build(overrides: Partial<Parameters<typeof buildFeedCards>[0]> = {}) {
  return buildFeedCards({
    businesses: [near, far],
    hours: [],
    promotions: [],
    menuItems: [],
    distanceKm: () => null,
    ...overrides,
  });
}

describe('interleave', () => {
  it('alternates and appends the rest of the longer list', () => {
    expect(interleave<number | string>([1, 2, 3], ['a'])).toEqual([1, 'a', 2, 3]);
    expect(interleave([], ['a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('buildFeedCards', () => {
  it('alternates promotions and dishes, nearest business first', () => {
    const cards = build({
      promotions: [promo('p-far', 'far', '2026-10-20'), promo('p-near', 'near', '2026-10-30')],
      menuItems: [dish('d-far', 'far', 1), dish('d-near', 'near', 5)],
    });

    expect(cards.map((c) => c.id)).toEqual([
      'promotion:p-near',
      'dish:d-near',
      'promotion:p-far',
      'dish:d-far',
    ]);
  });

  it('is deterministic whatever order the rows arrive in', () => {
    const promotions = [promo('b', 'near', '2026-10-20'), promo('a', 'near', '2026-10-20')];
    const first = build({ promotions }).map((c) => c.id);
    const second = build({ promotions: [...promotions].reverse() }).map((c) => c.id);

    expect(first).toEqual(second);
    expect(first).toEqual(['promotion:a', 'promotion:b']);
  });

  it(`keeps at most ${DISHES_PER_BUSINESS} available dishes per business, in menu order`, () => {
    const menuItems = [5, 1, 4, 2, 3].map((n) => dish(`d${n}`, 'near', n));
    menuItems.push(dish('hidden', 'near', 0, false));

    const ids = build({ menuItems }).map((c) => c.id);

    expect(ids).toEqual(['dish:d1', 'dish:d2', 'dish:d3']);
  });

  it('fills price, validity, icon, status and distance for each card', () => {
    const hours = [] as BusinessHours[];
    const [promoCard, dishCard] = build({
      hours,
      promotions: [promo('p', 'near', '2026-10-30T00:00:00Z')],
      menuItems: [dish('d', 'near', 1)],
      distanceKm: (b) => (b.id === 'near' ? 0.4 : null),
    });

    expect(promoCard).toMatchObject({ kind: 'promotion', priceCop: null, validUntil: '2026-10-30T00:00:00Z', menuItem: null });
    expect(dishCard).toMatchObject({ kind: 'dish', priceCop: 1000, validUntil: null, icon: 'coffee', status: 'closed', distanceKm: 0.4 });
    expect(dishCard.menuItem?.id).toBe('d');
  });

  it('ignores rows of businesses outside the batch', () => {
    expect(build({ menuItems: [dish('x', 'other', 1)] })).toEqual([]);
  });
});
