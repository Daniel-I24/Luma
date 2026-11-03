import { describe, expect, it } from 'vitest';
import shared from './rule-ideas.cases.json';
import type { SalesSummary } from './promotion-idea';
import { RulePromotionIdeas } from './rules-promotion-ideas';

// Same file as supabase/functions/suggest-promotions/ideas.cases.test.ts.
describe('ruleIdeas: cases shared with suggest-promotions', () => {
  for (const testCase of shared.cases) {
    it(testCase.name, () => {
      const ideas = RulePromotionIdeas.ruleIdeas(testCase.summary as SalesSummary, new Set(testCase.promoted));
      expect(
        ideas.map((i) => [i.menu_item_id, i.reason, i.discount_percent, i.final_cop, i.slot]),
      ).toEqual(testCase.expected);
    });
  }
});
