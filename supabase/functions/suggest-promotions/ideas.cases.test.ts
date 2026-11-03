import { assertEquals } from '@std/assert';

import { finalizeIdeas, ruleIdeas } from './ideas.ts';
import type { SalesSummary } from './model.ts';

// Same file as the app's rules spec (src/app/shared/promotions/advisor).
const CASES = new URL('../../../src/app/shared/promotions/advisor/rule-ideas.cases.json', import.meta.url);

interface RuleCase {
  readonly name: string;
  readonly summary: SalesSummary;
  readonly promoted: readonly string[];
  readonly expected: readonly unknown[];
}

const { cases } = JSON.parse(await Deno.readTextFile(CASES)) as { cases: RuleCase[] };

for (const testCase of cases) {
  Deno.test(`shared rules case: ${testCase.name}`, () => {
    const promoted = new Set(testCase.promoted);
    const ideas = finalizeIdeas(ruleIdeas(testCase.summary, promoted), testCase.summary, promoted);
    assertEquals(
      ideas.map((i) => [i.menu_item_id, i.reason, i.discount_percent, i.final_cop, i.slot]),
      testCase.expected,
    );
  });
}
