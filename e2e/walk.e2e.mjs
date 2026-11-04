import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { BUSINESS_ID, CUSTOMER_EMAIL, OWNER_EMAIL } from './support/data.mjs';
import { openApp, skipGuide, startBrowser } from './support/harness.mjs';

/**
 * Round 10 A6: every main screen, as a customer and as an owner, with a
 * clean console and never the global "Algo salió mal" (docs/qa-checklist.md).
 */
let env;
before(async () => (env = await startBrowser()));
after(() => env?.close());

const UNEXPECTED = 'Algo salió mal';

async function walk(user, paths) {
  const app = await openApp(env, { path: paths[0], user });
  const seen = [];
  for (const path of paths) {
    if (path !== paths[0]) await app.page.goto(env.origin + path);
    // Not "networkidle": the Realtime socket stays open on purpose.
    await app.page.waitForLoadState('load');
    await skipGuide(app.page);
    await app.page.waitForTimeout(800);
    const text = (await app.page.locator('body').textContent()) ?? '';
    if (text.includes(UNEXPECTED)) seen.push(path);
  }
  return { app, seen };
}

test('customer: map, feed, Luma IA, orders, notifications and profile, without "Algo salió mal"', async () => {
  const { app, seen } = await walk(CUSTOMER_EMAIL, ['/map', '/feed', '/ai', '/orders', '/notifications', '/profile']);
  // Luma IA keeps its chips and adds "Combos para …".
  await app.page.goto(env.origin + '/ai');
  await app.page.getByRole('heading', { name: /Combos para/ }).waitFor({ timeout: 5000 });
  assert.deepEqual(seen, []);
  assert.deepEqual(app.problems(), []);
  await app.close();
});

test('owner: panel, orders and profile, without "Algo salió mal"', async () => {
  const { app, seen } = await walk(OWNER_EMAIL, [`/owner/${BUSINESS_ID}`, `/owner/${BUSINESS_ID}/orders`, '/profile']);
  assert.deepEqual(seen, []);
  assert.deepEqual(app.problems(), []);
  await app.close();
});
