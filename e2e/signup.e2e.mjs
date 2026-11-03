import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { CODE, PASSWORD } from './support/data.mjs';
import { openApp, startBrowser } from './support/harness.mjs';

let env;
before(async () => (env = await startBrowser()));
after(() => env?.close());

test('sign-up: six steps, the e-mailed code, and the customer lands in the app', async () => {
  const app = await openApp(env, { path: '/auth/register' });
  const { page } = app;
  const next = () => page.getByRole('button', { name: 'Continuar' }).click();

  await page.locator('label:has(#signup-accountType)').click();
  await next();
  await page.locator('#signup-fullName').fill('Ana Prueba');
  await page.locator('#signup-phone').fill('3001234567');
  await next();
  await page.locator('#residence-department').selectOption({ label: 'Nariño' });
  await page.getByRole('button', { name: 'Pasto', exact: true }).click();
  await next();
  await next(); // the photo is optional
  await page.locator('#signup-email').fill('ana@example.test');
  await page.locator('#signup-password').fill(PASSWORD);
  await next();
  for (const id of ['acceptedTerms', 'acceptedPrivacy', 'isAdult']) await page.locator(`label:has(#signup-${id})`).first().click();
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await page.getByRole('heading', { name: /código/i }).waitFor();
  // Six digits are sent on their own (no button needed).
  await page.getByLabel(/código/i).first().fill(CODE);

  await page.waitForURL((url) => !url.pathname.startsWith('/auth'));
  assert.ok(app.backend.db.profiles.some((p) => p.full_name === 'Ana Prueba'), 'the profile was created from the sign-up');
  assert.deepEqual(app.problems(), []);
  await app.close();
});
