import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecommendationCandidate } from './recommendation.model';
import {
  FallbackRecommendationEngine,
  RemoteRecommendationEngine,
} from './remote-recommendation.engine';

const item = (id: string, section: string, price: number) =>
  ({
    id,
    business_id: 'b1',
    name: id,
    section,
    price_cop: price,
    is_available: true,
    sort_order: 0,
  }) as never;
const candidate = {
  business: { id: 'b1', name: 'Café' },
  status: 'open',
  distanceKm: 0.3,
  rating: 4.6,
  hasPromotion: true,
  isFavorite: false,
  menu: [
    item('m1', 'Platos fuertes', 10000),
    item('s1', 'Entradas', 4000),
    item('d1', 'Bebidas', 3000),
  ],
} as unknown as RecommendationCandidate;
const request = {
  moment: 'lunch' as const,
  candidates: [candidate],
  origin: { lat: 1.21, lng: -77.28 },
};

function client(result: { data: unknown; error: unknown }) {
  const invoke = vi.fn().mockResolvedValue(result);
  return { db: { functions: { invoke } } as unknown as SupabaseClient, invoke };
}

describe('RemoteRecommendationEngine', () => {
  it('sends only the moment, the location and the radius, and maps ids back to candidates', async () => {
    const { db, invoke } = client({
      data: {
        businesses: [
          { id: 'b1', reason: 'deal' },
          { id: 'unknown', reason: 'nearby' },
        ],
        combo: {
          business_id: 'b1',
          items: [
            { id: 'm1', final_cop: 8500 },
            { id: 's1', final_cop: 4000 },
            { id: 'd1', final_cop: 3000 },
          ],
          total_cop: 15500,
        },
      },
      error: null,
    });

    const result = await new RemoteRecommendationEngine(db).recommend(request);

    expect(invoke).toHaveBeenCalledWith('recommend', {
      method: 'POST',
      body: { moment: 'lunch', lat: 1.21, lng: -77.28, radius_km: 10 },
    });
    expect(result.businesses.map((b) => [b.candidate.business.id, b.reasons])).toEqual([
      ['b1', ['promotion']],
    ]);
    expect(result.combo?.totalCop).toBe(15500);
    expect(result.combo?.items.drink.id).toBe('d1');
  });

  it('fails without a location or on an error, and the fallback answers with the rules', async () => {
    const { db } = client({ data: null, error: new Error('503') });
    const remote = new RemoteRecommendationEngine(db);
    await expect(remote.recommend({ ...request, origin: null })).rejects.toThrow();
    await expect(remote.recommend(request)).rejects.toThrow();

    const rules = { recommend: vi.fn().mockResolvedValue({ businesses: [], combo: null }) };
    expect(await new FallbackRecommendationEngine(remote, rules).recommend(request)).toEqual({
      businesses: [],
      combo: null,
    });
    expect(rules.recommend).toHaveBeenCalledWith(request);
  });
});
