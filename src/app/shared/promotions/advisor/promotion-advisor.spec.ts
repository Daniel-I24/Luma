import { describe, expect, it, vi } from 'vitest';
import type { SupabaseService } from '@core/supabase/supabase.service';
import type { OwnerSalesRepository } from './owner-sales.repository';
import {
  FallbackPromotionAdvisor,
  RemotePromotionAdvisor,
  RulesPromotionAdvisor,
} from './promotion-advisor';
import type { SalesSummary } from './promotion-idea';
import { ruleIdeas } from './rules-promotion-ideas';

const summary: SalesSummary = {
  orders: 4,
  cancel_rate: 0,
  items: [
    { menu_item_id: 'slow', name: 'Empanada', price_cop: 9990, days_listed: 40, units: 0 },
    { menu_item_id: 'new', name: 'Jugo', price_cop: 5000, days_listed: 3, units: 1 },
    { menu_item_id: 'top', name: 'Tinto', price_cop: 2000, days_listed: 90, units: 30 },
  ],
  slots: [
    { dow: 5, slot: 'evening', orders: 8 },
    { dow: 2, slot: 'afternoon', orders: 1 },
  ],
};

describe('ruleIdeas (same rules as suggest-promotions below 10 orders)', () => {
  it('suggests unsold, new and quiet-moment items with server-like prices', () => {
    const ideas = ruleIdeas(summary, new Set());
    expect(ideas.map((i) => [i.menu_item_id, i.reason, i.discount_percent, i.final_cop])).toEqual([
      ['slow', 'slow_item', 15, 8492],
      ['new', 'new_item', 10, 4500],
      ['top', 'quiet_slot', 10, 1800],
    ]);
    expect(ideas[2].slot).toEqual({ dow: 2, slot: 'afternoon' });
  });

  it('skips items that already have a running promotion', () => {
    expect(ruleIdeas(summary, new Set(['slow', 'top'])).map((i) => i.menu_item_id)).toEqual([
      'new',
    ]);
  });
});

describe('advisors', () => {
  it('rules read the sales through the repository', async () => {
    const sales = {
      summary: vi.fn().mockResolvedValue({ data: summary, errorKey: null }),
      promotedItems: vi.fn().mockResolvedValue({ data: new Set(), errorKey: null }),
    } as unknown as OwnerSalesRepository;
    const result = await new RulesPromotionAdvisor(sales).suggest('b1');
    expect(result.source).toBe('rules');
    expect(result.ideas).toHaveLength(3);
  });

  it('remote failures fall back to the rules', async () => {
    const db = {
      functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: new Error('503') }) },
    } as unknown as SupabaseService['client'];
    const rules = { suggest: vi.fn().mockResolvedValue({ source: 'rules', ideas: [] }) };
    const advisor = new FallbackPromotionAdvisor(new RemotePromotionAdvisor(db), rules);

    expect(await advisor.suggest('b1')).toEqual({ source: 'rules', ideas: [] });
    expect(db.functions.invoke).toHaveBeenCalledWith('suggest-promotions', {
      method: 'POST',
      body: { business_id: 'b1' },
    });
  });
});
