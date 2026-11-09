import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { CUSTOMER_EMAIL } from './support/data.mjs';
import { openApp, skipGuide, startBrowser } from './support/harness.mjs';

/**
 * A customer in Cali: the label says where they are, the empty map explains that Luma is in
 * Pasto, "Explorar Pasto" shows its businesses and the way back to their location stays.
 */
let env;
before(async () => (env = await startBrowser()));
after(() => env?.close());

const CALI = { latitude: 3.45164, longitude: -76.53197, accuracy: 20 };
const MANY_DECIMALS = /\.\d{4,}/;

test('outside Pasto: the real zone, "Explorar Pasto" and back to my location', { timeout: 60_000 }, async () => {
  const app = await openApp(env, { path: '/auth/login', user: CUSTOMER_EMAIL });
  const { page, context } = app;
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(CALI);
  const asked = [];
  page.on('request', (request) => {
    if (request.url().includes('/functions/v1/geocode')) asked.push(request.postData() ?? '');
  });
  await page.goto(`${env.origin}/map`);
  await skipGuide(page);

  await page.getByText('En San Fernando').waitFor({ timeout: 15_000 });
  await page.getByRole('heading', { name: 'Luma está disponible en Pasto' }).waitFor({ timeout: 15_000 });
  assert.ok(asked.length > 0, 'the zone comes from the geocode function');
  assert.ok(asked.every((body) => !MANY_DECIMALS.test(body)), `no exact position is sent: ${asked}`);

  await page.getByRole('button', { name: 'Explorar Pasto' }).click();
  await page.locator('app-nearby-panel app-luma-business-card').first().waitFor({ timeout: 20_000 });
  await page.getByText(/^\s*Viendo /).waitFor({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Volver a mi ubicación' }).click();
  await page.getByText('En San Fernando').waitFor({ timeout: 20_000 });
  assert.equal(await page.getByRole('button', { name: 'Volver a mi ubicación' }).count(), 0);
  assert.deepEqual(app.problems(), []);
  await app.close();
});
