import { describe, expect, it } from 'vitest';
import type { Business } from '@shared/business/models/business.model';
import type { MenuItem } from '@shared/business/models/menu.model';
import { buildCombo, sectionRole } from './combo.util';
import type { RecommendationCandidate } from './recommendation.model';
import { RulesRecommendationEngine, momentForHour, scoreCandidate } from './rules-recommendation.engine';

let order = 0;
const item = (business_id: string, section: string | null, name: string, price_cop: number) =>
  ({ id: name, business_id, section, name, price_cop, sort_order: ++order, is_available: true }) as MenuItem;

function candidate(id: string, category: string, extra: Partial<RecommendationCandidate> = {}): RecommendationCandidate {
  return {
    business: { id, name: id, category } as Business,
    status: 'open',
    distanceKm: null,
    rating: null,
    hasPromotion: false,
    isFavorite: false,
    menu: [],
    ...extra,
  };
}

const cafe = candidate('cafe', 'Cafetería', {
  menu: [
    item('cafe', 'Bebidas calientes', 'Capuchino', 6500),
    item('cafe', 'Repostería', 'Croissant', 7000),
    item('cafe', 'Desayunos', 'Desayuno nariñense', 16000),
    item('cafe', 'Bebidas calientes', 'Americano', 4000),
  ],
});
const grill = candidate('grill', 'Restaurante', { menu: [item('grill', 'Platos fuertes', 'Fritanga', 28000)] });
const engine = new RulesRecommendationEngine();

describe('momentForHour', () => {
  it.each([
    [5, 'breakfast'], [9, 'breakfast'], [10, 'midMorning'], [12, 'lunch'],
    [15, 'afternoon'], [18, 'dinner'], [22, 'night'], [2, 'night'],
  ])('%i h → %s', (hour, moment) => {
    expect(momentForHour(hour)).toBe(moment);
  });
});

describe('RulesRecommendationEngine', () => {
  it('prefers categories that suit the moment', async () => {
    const breakfast = await engine.recommend({ moment: 'breakfast', candidates: [grill, cafe] });
    const lunch = await engine.recommend({ moment: 'lunch', candidates: [cafe, grill] });

    expect(breakfast.businesses[0].candidate.business.id).toBe('cafe');
    expect(breakfast.businesses[0].reasons).toContain('moment');
    expect(lunch.businesses[0].candidate.business.id).toBe('grill');
  });

  it('only recommends open or opening-soon businesses, at most three', async () => {
    const candidates = [
      candidate('a', 'Cafetería', { status: 'closed' }),
      candidate('b', 'Cafetería', { status: 'opening-soon' }),
      ...['c', 'd', 'e'].map((id) => candidate(id, 'Cafetería')),
    ];

    const result = await engine.recommend({ moment: 'breakfast', candidates });

    expect(result.businesses).toHaveLength(3);
    expect(result.businesses.map((b) => b.candidate.business.id)).not.toContain('a');
  });

  it('weighs distance (only when known), rating, promotion and favourites', () => {
    const plain = scoreCandidate(candidate('x', 'Tienda'), 'lunch').score;
    const rich = scoreCandidate(
      candidate('y', 'Tienda', { distanceKm: 0.5, rating: 4.5, hasPromotion: true, isFavorite: true }),
      'lunch',
    );

    expect(plain).toBe(0);
    expect(rich.score).toBeGreaterThan(50);
    expect(rich.reasons).toEqual(['near', 'topRated', 'promotion', 'favorite']);
  });

  it('builds a main + side + drink combo of one business with its total', async () => {
    const { combo } = await engine.recommend({ moment: 'breakfast', candidates: [cafe] });

    expect(combo?.business.id).toBe('cafe');
    expect(combo?.items.main.name).toBe('Desayuno nariñense');
    expect(combo?.items.side.name).toBe('Croissant');
    expect(combo?.items.drink.name).toBe('Capuchino');
    expect(combo?.totalCop).toBe(29500);
  });

  it('returns businesses without a combo when no menu covers the three roles', async () => {
    const result = await engine.recommend({ moment: 'lunch', candidates: [grill] });

    expect(result.businesses).toHaveLength(1);
    expect(result.combo).toBeNull();
    expect(buildCombo(grill)).toBeNull();
  });

  it('handles no data at all', async () => {
    expect(await engine.recommend({ moment: 'dinner', candidates: [] })).toEqual({
      businesses: [],
      combo: null,
    });
  });

  it('maps menu sections to combo roles with the dictionary', () => {
    expect(sectionRole('Platos fuertes')).toBe('main');
    expect(sectionRole('Entradas')).toBe('side');
    expect(sectionRole('BEBIDAS')).toBe('drink');
    expect(sectionRole('Despensa')).toBeNull();
    expect(sectionRole(null)).toBeNull();
  });
});
