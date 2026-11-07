import { assertEquals } from '@std/assert';

import { PaymentLog } from '../_shared/payments/payment-log.ts';
import { sandboxCredentials } from '../_shared/payments/payments.test-helper.ts';
import { createHandler, httpsReturnUrl } from './handler.ts';

const ORDER = '11111111-1111-4111-8111-111111111111';
const APK = 'https://localhost';
const WEB = 'https://luma.example';
const PAGE = 'https://luma.example/pago-listo.html';

function checkout(redirectUrl: string | null, origin: string) {
  const logs: string[] = [];
  const handler = createHandler({
    allowedOrigins: [APK, WEB],
    credentials: sandboxCredentials(),
    redirectUrl,
    authenticate: () => Promise.resolve({
      emailConfirmed: () => Promise.resolve(true),
      withinRateLimit: () => Promise.resolve(true),
      order: () => Promise.resolve({ status: 'awaiting_payment', paymentMethod: 'online' }),
      prepare: () => Promise.resolve({ reference: 'luma_abc', amountInCents: 1200000, expiresAt: '2026-10-24T15:15:00.000Z', attempt: 1 }),
    }),
    log: new PaymentLog((line) => logs.push(line)),
  });
  const request = new Request('http://localhost/functions/v1/create-payment', {
    method: 'POST',
    headers: { Origin: origin, Authorization: 'Bearer good', 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: ORDER }),
  });
  return { answer: handler(request), logs };
}

const redirectOf = async (answer: Promise<Response>) =>
  new URL((await (await answer).json()).checkout_url).searchParams.get('redirect-url');

Deno.test('the APK returns through the https page, never luma://', async () => {
  const url = await redirectOf(checkout(PAGE, APK).answer);
  assertEquals(url, `${PAGE}?order=${ORDER}`);
  assertEquals(new URL(url!).protocol, 'https:');
});

Deno.test('the web returns to its own /payments/return', async () => {
  assertEquals(await redirectOf(checkout(PAGE, WEB).answer), `${WEB}/payments/return?order=${ORDER}`);
});

Deno.test('without a valid return page the APK gets a clear refusal, not a checkout Wompi rejects', async () => {
  const { answer, logs } = checkout(null, APK);
  assertEquals((await answer).status, 503);
  assertEquals(logs.some((line) => line.includes('no_return_url')), true);
});

Deno.test('the web does not need the return page', async () => {
  assertEquals(await redirectOf(checkout(null, WEB).answer), `${WEB}/payments/return?order=${ORDER}`);
});

Deno.test('PAYMENT_RETURN_URL: only a public https address without a query', () => {
  assertEquals(httpsReturnUrl(PAGE), PAGE);
  for (const bad of [undefined, '', 'luma://payments/return', 'http://luma.example/x', 'https://localhost/x', 'https://luma.example/x?a=1', 'nope']) {
    assertEquals(httpsReturnUrl(bad), null, String(bad));
  }
});
