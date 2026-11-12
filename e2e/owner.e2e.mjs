import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { BUSINESS_ID, CUSTOMER_EMAIL, OWNER_EMAIL } from './support/data.mjs';
import { openApp, startBrowser } from './support/harness.mjs';
import { until } from './support/waits.mjs';

let env;
before(async () => (env = await startBrowser()));
after(() => env?.close());

test('owner panel: a new order arrives without refreshing, says "1 pedido nuevo" and is accepted', async () => {
  const app = await openApp(env, { path: `/owner/${BUSINESS_ID}/orders`, user: OWNER_EMAIL });
  const { page, backend, realtime } = app;
  await page.getByRole('heading', { name: 'Pedidos del negocio' }).waitFor();
  // The board and the shell listen to order_events before the customer orders (otherwise the event is lost).
  await until(() => realtime.listening('order_events') >= 2, 'the board and the shell subscribe to order_events');

  backend.act(CUSTOMER_EMAIL, 'create_order', {
    p_business_id: BUSINESS_ID, p_items: [{ menu_item_id: backend.db.menu_items[0].id, quantity: 2 }],
    p_pickup_at: null, p_notes: null, p_payment_method: 'pay_at_pickup',
  });
  await page.getByText('Tienes 1 pedido nuevo. Revísalos en Pedidos.').waitFor({ timeout: 5000 });
  await page.getByText('2 × Pan de yuca').waitFor();

  await page.getByRole('button', { name: 'Aceptar' }).click();
  await until(() => backend.db.orders.at(-1).status === 'accepted', 'the order is accepted in the database');
  await page.getByText('En preparación (1)').first().waitFor({ timeout: 5000 });
  assert.deepEqual(app.problems(), []);
  await app.close();
});
