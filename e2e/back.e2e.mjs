import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { BUSINESS_ID, CUSTOMER_EMAIL, OWNER_EMAIL } from './support/data.mjs';
import { openApp, startBrowser } from './support/harness.mjs';

/**
 * The browser's back (the same history the phone's back and gesture use)
 * leads to the parent screen: tabs and sections do not pile up, and an
 * ancestor opened again is not left twice in the history.
 */
let env;
before(async () => (env = await startBrowser()));
after(() => env?.close());

const pathOf = (page) => new URL(page.url()).pathname;

/** Waits until the app shows `expected` and has settled there; fails naming the path it stayed on. */
async function expectPath(app, expected) {
  await app.page.waitForFunction((path) => location.pathname === path, expected, { timeout: 10_000 })
    .catch(() => assert.fail(`expected ${expected}, the app is on ${pathOf(app.page)}`));
  await app.settle();
  assert.equal(pathOf(app.page), expected);
}

async function tap(app, name, expected) {
  await app.page.getByRole('link', { name, exact: true }).first().click();
  await expectPath(app, expected);
}

async function back(app, expected) {
  await app.page.goBack();
  await expectPath(app, expected);
}

test('customer: tabs do not pile up, and back from a tab is the map', { timeout: 60_000 }, async () => {
  const app = await openApp(env, { path: '/map', user: CUSTOMER_EMAIL });
  await expectPath(app, '/map');
  for (const [tab, path] of [['Pedidos', '/orders'], ['Descubrir', '/feed'], ['Perfil', '/profile']]) await tap(app, tab, path);
  await app.page.getByRole('link', { name: 'Mis favoritos' }).first().click();
  await expectPath(app, '/favorites');
  await back(app, '/profile');
  await back(app, '/map');
  await app.close();
});

test('owner: sections are siblings, and the arrow up is not left behind', { timeout: 60_000 }, async () => {
  const owner = `/owner/${BUSINESS_ID}`;
  const app = await openApp(env, { path: `${owner}/summary`, user: OWNER_EMAIL });
  await expectPath(app, `${owner}/summary`);
  for (const [tab, path] of [['Menú', 'menu'], ['Pedidos', 'orders'], ['Mi negocio', 'business']]) await tap(app, tab, `${owner}/${path}`);
  await back(app, `${owner}/summary`);
  await app.close();
});
