import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SupabaseService } from '@core/supabase/supabase.service';
import { createFakeSupabase, failure, ok } from '../../../../testing/fake-supabase';
import type { FakeResponse } from '../../../../testing/fake-supabase';
import { BusinessHighlightsRepository } from './business-highlights.repository';
import { FIXED_NOW, useFixedClock } from '../../../../testing/fixed-clock';

function setup(responses: Record<string, FakeResponse>) {
  const fake = createFakeSupabase(responses);
  TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: fake }] });
  return { repo: TestBed.inject(BusinessHighlightsRepository), queries: fake.queries };
}

describe('BusinessHighlightsRepository', () => {
  useFixedClock();

  it('loads the promotions of several businesses in one query', async () => {
    const promo = { id: 'p1', business_id: 'b1', title: '2×1' };
    const { repo, queries } = setup({ promotions: ok([promo]) });

    const result = await repo.getActivePromotions(['b1', 'b2', 'b3']);

    expect(result).toEqual({ data: [promo], errorKey: null });
    expect(queries).toHaveLength(1);
    expect(queries[0].call('in')).toEqual(['business_id', ['b1', 'b2', 'b3']]);
    expect(queries[0].call('eq')).toEqual(['is_active', true]);
    const now = new Date(FIXED_NOW).toISOString();
    expect(queries[0].call('lte')).toEqual(['starts_at', now]);
    expect(queries[0].call('gte')).toEqual(['ends_at', now]);
  });

  it('loads the ratings of several businesses in one query, as numbers', async () => {
    const { repo, queries } = setup({
      business_ratings: ok([
        { business_id: 'b1', average_rating: '4.5', review_count: 12 },
        { business_id: 'b3', average_rating: 3, review_count: 1 },
      ]),
    });

    const result = await repo.getRatings(['b1', 'b2', 'b3']);

    expect(queries).toHaveLength(1);
    expect(queries[0].table).toBe('business_ratings');
    expect(result.data?.get('b1')).toEqual({ businessId: 'b1', rating: 4.5, reviewCount: 12 });
    expect(result.data?.get('b3')?.rating).toBe(3);
    expect(result.data?.has('b2')).toBe(false);
  });

  it('skips the network when there are no businesses', async () => {
    const { repo, queries } = setup({});

    expect(await repo.getActivePromotions([])).toEqual({ data: [], errorKey: null });
    expect((await repo.getRatings([])).data?.size).toBe(0);
    expect(queries).toHaveLength(0);
  });

  it('maps Supabase errors to i18n keys', async () => {
    const { repo } = setup({ promotions: failure(), business_ratings: failure() });

    expect((await repo.getActivePromotions(['b1'])).errorKey).toBe(
      'businesses.errors.promotionsFailed',
    );
    expect((await repo.getRatings(['b1'])).errorKey).toBe('businesses.errors.ratingsFailed');
  });
});
