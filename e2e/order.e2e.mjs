import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { BUSINESS_ID, CUSTOMER_EMAIL, OWNER_EMAIL } from './support/data.mjs';
import { openApp, skipGuide, startBrowser } from './support/harness.mjs';

let env;
before(async () => (env = await startBrowser()));
after(() => env?.close());

/** Business → cart → checkout, skipping the first-visit guide. */
async function checkout(page) {
  await page.getByRole('button', { name: 'Agregar' }).first().click();
  await page.getByRole('link', { name: /Ver carrito/ }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await skipGuide(page);
}

test('pick-up order: placed, and the owner accepting it shows on the customer phone without refreshing', async () => {
  const app = await openApp(env, { path: `/businesses/${BUSINESS_ID}`, user: CUSTOMER_EMAIL });
  const { page, backend } = app;
  await checkout(page);
  // Online payment off (the default): pay at pick-up is the only way, nothing to choose.
  assert.equal(await page.getByRole('radio', { name: 'Pagar en línea' }).count(), 0);
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();

  await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/);
  await page.getByText('Pendiente').first().waitFor();
  const order = backend.db.orders.at(-1);
  assert.equal(order.payment_method, 'pay_at_pickup');
  assert.equal(order.total_cop, 2000, 'one Tinto, the first product of the menu');

  backend.act(OWNER_EMAIL, 'set_order_status', { p_order_id: order.id, p_status: 'accepted' });
  await page.getByText('Aceptado').first().waitFor({ timeout: 5000 });
  assert.deepEqual(app.problems(), []);
  await app.close();
});
