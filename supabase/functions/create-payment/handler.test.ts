import { assertEquals } from '@std/assert';

import { PaymentLog } from '../_shared/payments/payment-log.ts';
import { sandboxCredentials, sandboxSecrets } from '../_shared/payments/payments.test-helper.ts';
import { sha256Hex } from '../_shared/payments/secure-compare.ts';
import { type CustomerPayments, createHandler, type Prepared } from './handler.ts';

const ORIGIN = 'https://localhost';
const ORDER = '11111111-1111-4111-8111-111111111111';
const EXPIRES = '2026-10-24T15:15:00.000Z';

function setup(options: Partial<{
  credentials: boolean; confirmed: boolean; rate: boolean; order: { status: string; paymentMethod: string } | null;
  prepared: Prepared;
}> = {}) {
  const logs: string[] = [];
  const prepared: string[] = [];
  const customer: CustomerPayments = {
    emailConfirmed: () => Promise.resolve(options.confirmed ?? true),
    withinRateLimit: () => Promise.resolve(options.rate ?? true),
    order: () => Promise.resolve(options.order === undefined ? { status: 'awaiting_payment', paymentMethod: 'online' } : options.order),
    prepare: (orderId, environment) => {
      prepared.push(`${orderId}/${environment}`);
      return Promise.resolve(options.prepared ?? { reference: 'luma_abc', amountInCents: 1200000, expiresAt: EXPIRES, attempt: 1 });
    },
  };
  const handler = createHandler({
    allowedOrigins: [ORIGIN],
    credentials: options.credentials === false ? null : sandboxCredentials(),
    redirectUrl: 'luma://payments/return',
    authenticate: (token) => Promise.resolve(token === 'good' ? customer : null),
    log: new PaymentLog((line) => logs.push(line)),
  });
  return { handler, logs, prepared };
}

const post = (body: unknown, token = 'good', origin = ORIGIN) =>
  new Request('http://localhost/functions/v1/create-payment', {
    method: 'POST',
    headers: { Origin: origin, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

Deno.test('answers a signed checkout URL with the amount and reference from the database', async () => {
  const { handler, prepared, logs } = setup();
  const res = await handler(post({ order_id: ORDER, amount_in_cents: 1 }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals([body.attempt, body.expires_at, body.sandbox], [1, EXPIRES, true]);
  const q = new URL(body.checkout_url).searchParams;
  assertEquals([q.get('amount-in-cents'), q.get('reference')], ['1200000', 'luma_abc']);
  assertEquals(q.get('redirect-url'), `luma://payments/return?order=${ORDER}`);
  assertEquals(q.get('signature:integrity'), await sha256Hex(`luma_abc1200000COP${EXPIRES}${sandboxSecrets().WOMPI_INTEGRITY_SECRET}`));
  assertEquals(prepared, [`${ORDER}/test`]);
  const everything = JSON.stringify(body) + logs.join('');
  for (const secret of ['WOMPI_INTEGRITY_SECRET', 'WOMPI_PRIVATE_KEY', 'WOMPI_EVENTS_SECRET'] as const) {
    assertEquals(everything.includes(sandboxSecrets()[secret]), false, secret);
  }
  assertEquals(everything.includes('luma_abc') && logs.join('').includes('luma_abc'), false);
});

Deno.test('session, origin and body are checked first', async () => {
  const { handler, prepared } = setup();
  assertEquals((await handler(post({ order_id: ORDER }, 'bad'))).status, 401);
  assertEquals((await handler(post({ order_id: ORDER }, 'good', 'https://evil.example'))).status, 403);
  assertEquals((await handler(post({ order_id: 'nope' }))).status, 400);
  assertEquals((await handler(post('{"order_id": '))).status, 400);
  assertEquals((await handler(post({ order_id: ORDER, pad: 'x'.repeat(600) }))).status, 400);
  assertEquals(prepared.length, 0);
});

Deno.test('confirmed email, rate limit and the order state come before any attempt', async () => {
  assertEquals((await setup({ confirmed: false }).handler(post({ order_id: ORDER }))).status, 403);
  assertEquals((await setup({ rate: false }).handler(post({ order_id: ORDER }))).status, 429);
  assertEquals((await setup({ order: null }).handler(post({ order_id: ORDER }))).status, 404);
  const cash = setup({ order: { status: 'pending', paymentMethod: 'pay_at_pickup' } });
  assertEquals((await cash.handler(post({ order_id: ORDER }))).status, 409);
  assertEquals(cash.prepared.length, 0);
});

Deno.test('prepare_payment rules map to stable codes; missing secrets are 503', async () => {
  const limited = await setup({ prepared: { error: 'too_many_attempts' } }).handler(post({ order_id: ORDER }));
  assertEquals([limited.status, await limited.json()], [409, { error: 'too_many_attempts' }]);
  const odd = await setup({ prepared: { error: 'something_else' } }).handler(post({ order_id: ORDER }));
  assertEquals([odd.status, await odd.json()], [503, { error: 'payments_unavailable' }]);
  assertEquals((await setup({ credentials: false }).handler(post({ order_id: ORDER }))).status, 503);
});

Deno.test('an attempt still in progress answers 409 with the seconds left', async () => {
  const res = await setup({ prepared: { error: 'attempt_in_progress', retryAfterSeconds: 95 } }).handler(post({ order_id: ORDER }));
  assertEquals([res.status, res.headers.get('Retry-After'), await res.json()],
    [409, '95', { error: 'attempt_in_progress', retry_after_seconds: 95 }]);
});
