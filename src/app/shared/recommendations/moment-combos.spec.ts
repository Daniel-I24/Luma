import { describe, expect, it } from 'vitest';
import type { Business, BusinessHours } from '@shared/business/models/business.model';
import type { MenuItem } from '@shared/business/models/menu.model';
import { DAY_MOMENTS, type DayMoment, type RecommendationCandidate } from './recommendation.model';
import { MomentCombos } from './moment-combos';

let n = 0;
const item = (business: string, section: string, name: string, price: number): MenuItem => ({
  id: `m${++n}`, business_id: business, name, description: null, price_cop: price, image_url: null, section,
  sort_order: n, is_available: true, created_at: '',
});
const candidate = (id: string, menu: MenuItem[], distanceKm: number | null = 0.5): RecommendationCandidate => ({
  business: { id, name: `Negocio ${id}` } as Business, status: 'open', distanceKm, rating: null, hasPromotion: false, isFavorite: false, menu,
});

/** One business per moment with that moment's dish, drink and extra. */
const MENUS: Record<DayMoment, [string, string, string][]> = {
  breakfast: [['Desayunos', 'Calentado', 'x'], ['Bebidas calientes', 'Tinto', 'x'], ['Panadería', 'Pan de yuca', 'x']],
  midMorning: [['Empanadas', 'Empanada de pipián', 'x'], ['Jugos', 'Jugo de lulo', 'x'], ['Frutas', 'Salpicón', 'x']],
  lunch: [['Almuerzos', 'Almuerzo ejecutivo', 'x'], ['Bebidas', 'Limonada', 'x'], ['Sopas', 'Sopa de arroz', 'x']],
  afternoon: [['Repostería', 'Torta de natas', 'x'], ['Café', 'Capuchino', 'x'], ['Galletas', 'Galleta', 'x']],
  dinner: [['Platos fuertes', 'Cuy asado', 'x'], ['Bebidas', 'Jugo de mora', 'x'], ['Postres', 'Arroz con leche', 'x']],
  night: [['Hamburguesas', 'Hamburguesa', 'x'], ['Gaseosas', 'Gaseosa', 'x'], ['Acompañamientos', 'Papas', 'x']],
};
const always = (): boolean => true;

describe('MomentCombos', () => {
  for (const moment of DAY_MOMENTS) {
    it(`${moment}: dish, drink and extra of an open business nearby, with the total`, () => {
      const menu = MENUS[moment].map(([section, name], i) => item('b1', section, name, 1000 * (i + 1)));
      const [combo] = MomentCombos.forMoment([candidate('b1', menu)], moment, always);
      expect([combo?.dish.name, combo?.drink.name, combo?.extra?.name]).toEqual(MENUS[moment].map(([, name]) => name));
      expect(combo?.totalCop).toBe(6000);
    });
  }

  it('2 or 3 combos, ranked like the recommendation; closed, far or incomplete businesses are left out', () => {
    const lunch = (id: string) => [item(id, 'Almuerzos', `Almuerzo ${id}`, 12000), item(id, 'Bebidas', 'Jugo', 3000)];
    const list = MomentCombos.forMoment(
      [
        candidate('near', lunch('near'), 0.4), candidate('ranked', lunch('ranked'), 2), candidate('far', lunch('far'), 8),
        candidate('closed', lunch('closed')), candidate('noDrink', [item('noDrink', 'Almuerzos', 'Bandeja', 15000)]),
        candidate('soldOut', [item('soldOut', 'Almuerzos', 'Bandeja', 15000), { ...item('soldOut', 'Bebidas', 'Jugo', 3000), is_available: false }]),
      ],
      'lunch',
      (c) => c.business.id !== 'closed',
      ['ranked'],
    );
    expect(list.map((c) => c.business.id)).toEqual(['ranked', 'near']);
    expect(list[0]?.extra).toBeNull();
  });

  it('a single business gets a second combo with its next dish; without products, nothing is invented', () => {
    const menu = [item('b1', 'Almuerzos', 'Bandeja', 15000), item('b1', 'Almuerzos', 'Sudado', 13000), item('b1', 'Bebidas', 'Jugo', 3000)];
    expect(MomentCombos.forMoment([candidate('b1', menu)], 'lunch', always).map((c) => c.dish.name)).toEqual(['Bandeja', 'Sudado']);
    expect(MomentCombos.forMoment([candidate('b2', [])], 'lunch', always)).toEqual([]);
  });

  it('open during the window: the next occurrence, across midnight too', () => {
    const day = (d: number, opens: string, closes: string): BusinessHours =>
      ({ business_id: 'b1', day_of_week: d, opens_at: opens, closes_at: closes, is_closed: false }) as BusinessHours;
    const week = (opens: string, closes: string) => [0, 1, 2, 3, 4, 5, 6].map((d) => day(d, opens, closes));
    const at = (h: number) => new Date(2026, 10, 4, h, 0);
    expect(MomentCombos.openDuringWindow(week('06:00', '11:00'), { from: 5, to: 10 }, at(20))).toBe(true);
    expect(MomentCombos.openDuringWindow(week('12:00', '15:00'), { from: 5, to: 10 }, at(7))).toBe(false);
    expect(MomentCombos.openDuringWindow(week('20:00', '02:00'), { from: 22, to: 29 }, at(1))).toBe(true);
    expect(MomentCombos.inWindow(3, { from: 22, to: 29 })).toBe(true);
  });
});
