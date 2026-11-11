import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { BUSINESS_ID, CUSTOMER_EMAIL, OWNER_EMAIL } from './support/data.mjs';
import { openApp, skipGuide, startBrowser } from './support/harness.mjs';

/**
 * The browser's back (the same history the phone's back and gesture use)
 * leads to the parent screen: tabs and sections do not pile up, and an
 * ancestor opened again is not left twice in the history.
 */
let env;
before(async () => (env = await startBrowser()));
after(() => env?.close());

const pathOf = (page) => new URL(page.url()).pathname;

/** Each section starts its guide 700 ms after the first visit; it is skipped once it shows. */
async function tap(page, name) {
  await page.getByRole('link', { name, exact: true }).first().click();
  await page.waitForTimeout(1000);
  await skipGuide(page);
}

async function back(page) {
  await page.goBack();
  await page.waitForTimeout(400);
  return pathOf(page);
}

test('customer: tabs do not pile up, and back from a tab is the map', { timeout: 60_000 }, async () => {
  const app = await openApp(env, { path: '/map', user: CUSTOMER_EMAIL });
  const { page } = app;
  await skipGuide(page);
  for (const tab of ['Pedidos', 'Descubrir', 'Perfil']) await tap(page, tab);
  await page.getByRole('link', { name: 'Mis favoritos' }).first().click();
  await page.waitForTimeout(1000);
  await skipGuide(page);
  assert.equal(pathOf(page), '/favorites');
  assert.equal(await back(page), '/profile');
  assert.equal(await back(page), '/map');
  await app.close();
});

test('owner: sections are siblings, and the arrow up is not left behind', { timeout: 60_000 }, async () => {
  const owner = `/owner/${BUSINESS_ID}`;
  const app = await openApp(env, { path: `${owner}/summary`, user: OWNER_EMAIL });
  const { page } = app;
  await skipGuide(page);
  for (const tab of ['Menú', 'Pedidos', 'Mi negocio']) await tap(page, tab);
  assert.equal(pathOf(page), `${owner}/business`);
  assert.equal(await back(page), `${owner}/summary`);
  await app.close();
});
