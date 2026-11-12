import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { BUSINESS_ID, CUSTOMER_EMAIL, CUSTOMER_ID, OWNER_EMAIL, OWNER_ID } from './support/data.mjs';
import { TOUR_IDS } from './support/guides.mjs';
import { openApp, startBrowser } from './support/harness.mjs';

/**
 * The first-visit guide of every section (the other flows start with them seen): it shows over
 * its screen, "Saltar" closes it, and it is remembered for that user on this device.
 */
let env;
before(async () => (env = await startBrowser()));
after(() => env?.close());

const owner = (tab) => `/owner/${BUSINESS_ID}/${tab}`;
const CUSTOMER_TOURS = { map: '/map', discover: '/feed', orders: '/orders', ai: '/ai', profile: '/profile' };
const OWNER_TOURS = {
  'owner-summary': owner('summary'), 'owner-orders': owner('orders'), 'owner-menu': owner('menu'),
  'owner-promotions': owner('promotions'), 'owner-business': owner('business'),
};

/** The guide of the screen shows, "Saltar" closes it, and DeviceStorage remembers it. */
async function seeAndSkip(app, userId, tour) {
  const skip = app.page.getByRole('button', { name: 'Saltar' });
  await skip.waitFor({ timeout: 10_000 });
  await skip.click();
  await skip.waitFor({ state: 'detached', timeout: 5000 });
  const remembered = await app.page.evaluate((key) => localStorage.getItem(key), `luma.tour.${userId}.${tour}`);
  assert.ok(remembered, `${tour}: remembered as seen`);
}

async function walk(email, userId, tours) {
  const app = await openApp(env, { path: Object.values(tours)[0], user: email, guides: true });
  for (const [tour, path] of Object.entries(tours)) {
    if (path !== app.page.url().replace(env.origin, '')) await app.page.goto(env.origin + path);
    await seeAndSkip(app, userId, tour);
  }
  return app;
}

test('every guide of the app is checked here', () => {
  const covered = [...Object.keys(CUSTOMER_TOURS), 'checkout', ...Object.keys(OWNER_TOURS)];
  assert.deepEqual([...covered].sort(), [...TOUR_IDS].sort());
});

test('customer: each section shows its guide once, and "Saltar" closes it', { timeout: 120_000 }, async () => {
  const app = await walk(CUSTOMER_EMAIL, CUSTOMER_ID, CUSTOMER_TOURS);
  // Checkout needs something in the cart.
  await app.page.goto(`${env.origin}/businesses/${BUSINESS_ID}`);
  await app.page.getByRole('button', { name: 'Agregar' }).first().click();
  await app.page.getByRole('link', { name: /Ver carrito/ }).click();
  await app.page.getByRole('button', { name: 'Continuar' }).click();
  await seeAndSkip(app, CUSTOMER_ID, 'checkout');
  assert.deepEqual(app.problems(), []);
  await app.close();
});

test('owner: each section of the panel shows its guide once, and "Saltar" closes it', { timeout: 120_000 }, async () => {
  const app = await walk(OWNER_EMAIL, OWNER_ID, OWNER_TOURS);
  assert.deepEqual(app.problems(), []);
  await app.close();
});
