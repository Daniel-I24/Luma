import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { CUSTOMER_EMAIL, CUSTOMER_ID } from './support/data.mjs';
import { openApp, startBrowser } from './support/harness.mjs';

/**
 * The web as an iPhone uses it, in WebKit with the iPhone 13 profile (E2E_BROWSER=webkit,
 * `npm run test:e2e:webkit`). Elsewhere it is skipped: these are Safari's rules.
 */
const skip = process.env.E2E_BROWSER === 'webkit' ? false : 'needs E2E_BROWSER=webkit';
const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
// The smallest valid JPEG-like picture a canvas can decode: a 1×1 PNG.
const PICTURE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

let env;
before(async () => { if (!skip) env = await startBrowser(); });
after(() => env?.close());

const meta = (page, name) => page.locator(`meta[name="${name}"]`).getAttribute('content');

test('"Añadir a pantalla de inicio": full screen, title, icon and manifest', { skip }, async () => {
  const app = await openApp(env, { path: '/auth/login' });
  const { page } = app;
  assert.equal(await meta(page, 'apple-mobile-web-app-capable'), 'yes');
  assert.equal(await meta(page, 'mobile-web-app-capable'), 'yes');
  assert.equal(await meta(page, 'apple-mobile-web-app-title'), 'Luma');
  assert.equal(await meta(page, 'apple-mobile-web-app-status-bar-style'), 'black-translucent');
  assert.match(await meta(page, 'viewport'), /viewport-fit=cover/);
  const icon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  assert.equal((await page.request.get(`${env.origin}/${icon}`)).status(), 200);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, '/');
  await app.close();
});

test('no form field makes Safari zoom in: at least 16 px on a touch screen', { skip }, async () => {
  const app = await openApp(env, { path: '/auth/login' });
  await app.page.locator('input').first().waitFor();
  assert.equal(await app.page.evaluate(() => matchMedia('(pointer: coarse)').matches), true, 'the emulated iPhone is a touch screen');
  const sizes = await app.page.$$eval('input:not([type=checkbox]):not([type=radio]):not([type=file])', (all) => all.map((el) => parseFloat(getComputedStyle(el).fontSize)));
  assert.ok(sizes.length > 0);
  assert.ok(sizes.every((size) => size >= 16), `sizes: ${sizes}`);
  await app.close();
});

test('main screens fit the iPhone and show no errors', { skip }, async () => {
  const app = await openApp(env, { path: '/map', user: CUSTOMER_EMAIL });
  for (const path of ['/map', '/feed', '/orders', '/notifications', '/profile', '/account/details']) {
    if (path !== '/map') await app.page.goto(env.origin + path);
    await app.page.waitForLoadState('load');
    // Every request of the screen answered: leaving earlier cancels them, and WebKit reports that.
    await app.settle();
    const overflow = await app.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${path} scrolls sideways by ${overflow}`);
  }
  assert.deepEqual(app.problems(), []);
  await app.close();
});

test('a photo from the picker is re-encoded, uploaded and shown in the profile', { skip }, async () => {
  const app = await openApp(env, { path: '/account/details', user: CUSTOMER_EMAIL });
  const { page, backend } = app;
  await page.getByRole('checkbox', { name: /foto/i }).check();
  await page.locator('app-avatar-settings input[type=file]').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PICTURE });
  await page.locator('app-avatar-settings img').waitFor({ timeout: 8000 });
  // The upload and the profile update answered before the database is read.
  await app.settle();
  const profile = backend.db.profiles.find((row) => row.id === CUSTOMER_ID);
  assert.match(profile.avatar_path, new RegExp(`^${CUSTOMER_ID}/avatar/.+\\.(webp|jpg)$`));
  assert.ok(profile.avatar_consent_at);
  await page.goto(`${env.origin}/profile`);
  // The signed URL of the uploaded photo is served, so the picture really loads (an error would hide the img).
  await page.waitForFunction(() => {
    const img = document.querySelector('header app-luma-avatar img');
    return !!img && img.complete && img.naturalWidth > 0;
  }, null, { timeout: 8000 });
  assert.deepEqual(app.problems(), []);
  await app.close();
});

test('with the permission given, the map reads the position and the button shows it', { skip }, async () => {
  const app = await openApp(env, { path: '/map', user: CUSTOMER_EMAIL });
  const { page, context } = app;
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 1.2136, longitude: -77.2811, accuracy: 20 });
  await page.getByText('En San Fernando').waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'Centrar en mi ubicación' }).waitFor();
  await app.close();
});

test('the notifications screen says what the web can do', { skip }, async () => {
  const app = await openApp(env, { path: '/profile', user: CUSTOMER_EMAIL });
  await app.page.getByText(/iPhone/).first().waitFor({ state: 'attached', timeout: 8000 });
  await app.close();
});
