import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { BUSINESS_ID, CUSTOMER_EMAIL, OWNER_EMAIL } from './support/data.mjs';
import { axeViolations } from './support/axe.mjs';
import { rawText } from './support/raw-text.mjs';
import { openApp, skipGuide, startBrowser } from './support/harness.mjs';

/**
 * Round 10 A6: every main screen, as a customer and as an owner, with a
 * clean console, never the global "Algo salió mal", no serious or critical
 * axe violation (WCAG 2.1 AA; docs/qa-checklist.md), and never a
 * translation key or an internal status on screen.
 */
let env;
before(async () => (env = await startBrowser()));
after(() => env?.close());

const UNEXPECTED = 'Algo salió mal';

async function walk(user, paths) {
  const app = await openApp(env, { path: paths[0], user });
  const seen = [];
  const a11y = [];
  const raw = [];
  for (const path of paths) {
    if (path !== paths[0]) await app.page.goto(env.origin + path);
    // Not "networkidle": the Realtime socket stays open on purpose.
    await app.page.waitForLoadState('load');
    await skipGuide(app.page);
    await app.page.waitForTimeout(800);
    const text = (await app.page.locator('body').textContent()) ?? '';
    if (text.includes(UNEXPECTED)) seen.push(path);
    for (const leak of await rawText(app.page)) raw.push(`${path} ${leak}`);
    for (const violation of await axeViolations(app.page)) a11y.push(`${path} ${violation}`);
  }
  return { app, seen, a11y, raw };
}

test('customer: map, feed, Luma IA, orders, notifications and profile, without "Algo salió mal"', async () => {
  const { app, seen, a11y, raw } = await walk(CUSTOMER_EMAIL, ['/map', '/feed', '/ai', '/orders', '/notifications', '/profile', '/account/data', '/promotions', '/favorites']);
  // Luma IA keeps its chips and adds "Combos para …".
  await app.page.goto(env.origin + '/ai');
  await app.page.getByRole('heading', { name: /Combos para/ }).waitFor({ timeout: 5000 });
  assert.deepEqual(seen, []);
  assert.deepEqual(a11y, []);
  assert.deepEqual(raw, []);
  assert.deepEqual(app.problems(), []);
  await app.close();
});

test('owner: panel, orders and profile, without "Algo salió mal"', async () => {
  const owner = `/owner/${BUSINESS_ID}`;
  const { app, seen, a11y, raw } = await walk(OWNER_EMAIL, [owner, `${owner}/orders`, `${owner}/menu`, `${owner}/promotions`, `${owner}/business`, `${owner}/business/contact`, '/profile']);
  assert.deepEqual(seen, []);
  assert.deepEqual(a11y, []);
  assert.deepEqual(raw, []);
  assert.deepEqual(app.problems(), []);
  await app.close();
});
