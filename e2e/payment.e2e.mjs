import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { BUSINESS_ID, CUSTOMER_EMAIL } from './support/data.mjs';
import { openApp, skipGuide, startBrowser } from './support/harness.mjs';

let env;
before(async () => (env = await startBrowser()));
after(() => env?.close());

test('online payment (simulated Wompi sandbox): checkout, pay, back to the web app with the order paid', async () => {
  const app = await openApp(env, { path: `/businesses/${BUSINESS_ID}`, user: CUSTOMER_EMAIL, payments: true });
  const { page, backend } = app;
  await page.getByRole('button', { name: 'Agregar' }).first().click();
  await page.getByRole('link', { name: /Ver carrito/ }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await skipGuide(page);
  await page.getByRole('button', { name: 'Pagar en línea' }).click();
  // With online payment chosen, the main button says "Pagar".
  await page.getByRole('button', { name: 'Pagar', exact: true }).click();

  // Wompi's hosted checkout (simulated): the app never sees the card.
  await page.waitForURL(/checkout\.wompi\.co/);
  await page.getByRole('button', { name: /Pagar con la tarjeta/ }).click();

  // Back on the web app (not luma://), the order says it was paid.
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/);
  await page.getByText('Pagado en línea').first().waitFor({ timeout: 5000 });
  const order = backend.db.orders.at(-1);
  assert.deepEqual([order.payment_method, order.payment_status], ['online', 'approved']);
  assert.deepEqual(app.problems(), []);
  await app.close();
});
