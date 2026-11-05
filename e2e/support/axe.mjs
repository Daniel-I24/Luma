/**
 * Accessibility check of the screen in view with axe-core (WCAG 2.0/2.1 A
 * and AA rules). Returns the serious and critical violations as short lines
 * ("rule: selector"), for `assert.deepEqual(await axeViolations(page), [])`.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AXE_SOURCE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BLOCKING = new Set(['serious', 'critical']);

export async function axeViolations(page) {
  await page.evaluate(AXE_SOURCE);
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return result.violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
  return violations.filter((v) => BLOCKING.has(v.impact)).map((v) => `${v.id}: ${v.targets.join(' | ')}`);
}
