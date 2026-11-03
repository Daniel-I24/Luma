import { assertEquals } from '@std/assert';

import { PaymentLog } from '../_shared/payments/payment-log.ts';
import { transaction } from '../_shared/payments/payments.test-helper.ts';
import { createHandler, type VoidTarget } from './handler.ts';

const ORIGIN = 'https://localhost';
const PAYMENT = '22222222-2222-4222-8222-222222222222';

function setup(target: VoidTarget, options: { accepted?: boolean; status?: string } = {}) {
  const voided: string[] = [];
  const recorded: string[] = [];
  const handler = createHandler({
    allowedOrigins: [ORIGIN],
    authenticate: (token) => Promise.resolve(token === 'admin' ? { requestVoid: () => Promise.resolve(target) } : null),
    gateway: {
      environment: 'test',
      void: (id) => Promise.resolve(void voided.push(id)).then(() => options.accepted ?? true),
      transaction: (id) => Promise.resolve(transaction({ id, status: options.status ?? 'VOIDED' })),
      record: (tx) => Promise.resolve(void recorded.push(tx.status)).then(() => 'applied'),
    },
    log: new PaymentLog(() => undefined),
  });
  return { handler, voided, recorded };
}

const post = (body: unknown, token = 'admin') => new Request('http://localhost/functions/v1/void-payment', {
  method: 'POST', headers: { Origin: ORIGIN, Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
});
const card: VoidTarget = { transactionId: 'tx-1', environment: 'test', card: true };

Deno.test('a card payment is voided through the API and recorded after confirming it', async () => {
  const { handler, voided, recorded } = setup(card);
  const res = await handler(post({ payment_id: PAYMENT }));
  assertEquals([res.status, await res.json()], [200, { result: 'voided' }]);
  assertEquals([voided, recorded], [['tx-1'], ['VOIDED']]);
});

Deno.test('other methods, refused voids and unconfirmed voids are not recorded as voided', async () => {
  const nequi = setup({ ...card, card: false });
  assertEquals(await (await nequi.handler(post({ payment_id: PAYMENT }))).json(), { result: 'manual' });
  assertEquals(nequi.voided.length, 0);
  assertEquals(await (await setup(card, { accepted: false }).handler(post({ payment_id: PAYMENT }))).json(), { result: 'manual' });
  const pending = setup(card, { status: 'APPROVED' });
  assertEquals(await (await pending.handler(post({ payment_id: PAYMENT }))).json(), { result: 'pending' });
  assertEquals(pending.recorded.length, 0);
});

Deno.test('only admins with aal2, valid ids and the same environment', async () => {
  assertEquals((await setup(card).handler(post({ payment_id: PAYMENT }, 'customer'))).status, 401);
  assertEquals((await setup(card).handler(post({ payment_id: 'x' }))).status, 400);
  assertEquals((await setup({ error: 'not_admin' }).handler(post({ payment_id: PAYMENT }))).status, 403);
  assertEquals((await setup({ error: 'payment_not_voidable' }).handler(post({ payment_id: PAYMENT }))).status, 409);
  const prod = setup({ ...card, environment: 'prod' });
  assertEquals((await prod.handler(post({ payment_id: PAYMENT }))).status, 409);
  assertEquals(prod.voided.length, 0);
});
