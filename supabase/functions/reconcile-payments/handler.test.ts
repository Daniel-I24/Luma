import { assertEquals } from '@std/assert';

import { PaymentLog } from '../_shared/payments/payment-log.ts';
import { createHandler } from './handler.ts';

const SECRET = 'c'.repeat(40);

function setup(options: { run?: boolean; fail?: boolean } = {}) {
  let runs = 0;
  const handler = createHandler({
    cronSecret: SECRET,
    isAdmin: (token) => Promise.resolve(token === 'admin'),
    run: options.run === false ? null : () => {
      runs++;
      return options.fail ? Promise.reject(new Error('db')) : Promise.resolve({ checked: 2, applied: 1, skipped: 1 });
    },
    log: new PaymentLog(() => undefined),
  });
  return { handler, runs: () => runs };
}

const call = (headers: Record<string, string>, method = 'POST') =>
  new Request('http://localhost/functions/v1/reconcile-payments', { method, headers });

Deno.test('the cron secret or an admin JWT runs it; nothing else does', async () => {
  const { handler, runs } = setup();
  const byCron = await handler(call({ 'x-cron-secret': SECRET }));
  assertEquals([byCron.status, await byCron.json()], [200, { checked: 2, applied: 1, skipped: 1 }]);
  assertEquals((await handler(call({ Authorization: 'Bearer admin' }))).status, 200);
  assertEquals((await handler(call({ Authorization: 'Bearer customer' }))).status, 401);
  assertEquals((await handler(call({ 'x-cron-secret': SECRET.slice(1) }))).status, 401);
  assertEquals((await handler(call({}))).status, 401);
  assertEquals((await handler(call({ 'x-cron-secret': SECRET }, 'GET'))).status, 405);
  assertEquals(runs(), 2);
});

Deno.test('missing Wompi secrets or a failing run are 503', async () => {
  assertEquals((await setup({ run: false }).handler(call({ 'x-cron-secret': SECRET }))).status, 503);
  assertEquals((await setup({ fail: true }).handler(call({ 'x-cron-secret': SECRET }))).status, 503);
});
