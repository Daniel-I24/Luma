import { assertEquals, assertRejects, assertThrows } from '@std/assert';

import { CheckoutUrlBuilder } from './checkout-url-builder.ts';
import { IntegritySignature } from './integrity-signature.ts';
import { MerchantCredentialsFactory } from './merchant-credentials.ts';
import { Money } from './money.ts';
import { PaymentLog } from './payment-log.ts';
import { type PaymentStatus, PaymentStateMachine } from './payment-state-machine.ts';
import { sha256Hex } from './secure-compare.ts';
import { DOC_INTEGRITY_SECRET, sandboxSecrets } from './payments.test-helper.ts';

Deno.test('Money is whole cents from whole pesos; floats and negatives are refused', () => {
  assertEquals(Money.fromPesos(24900).cents, 2490000);
  assertEquals(Money.fromCents(2490000).equals({ cents: 2490000, currency: 'COP' }), true);
  assertEquals(Money.fromCents(2490000).equals({ cents: 2490000, currency: 'USD' }), false);
  for (const bad of [10.5, -1, Number.NaN, Number.MAX_SAFE_INTEGER]) assertThrows(() => Money.fromPesos(bad));
  assertThrows(() => Money.fromCents(0.1));
});

Deno.test('PaymentStateMachine matches the 49 vectors shared with SQL', async () => {
  const url = new URL('../../../tests/fixtures/payment_transitions.json', import.meta.url);
  const { vectors } = JSON.parse(await Deno.readTextFile(url)) as {
    vectors: { from: PaymentStatus; to: PaymentStatus; allowed: boolean }[];
  };
  assertEquals(vectors.length, 49);
  for (const v of vectors) assertEquals(PaymentStateMachine.canTransition(v.from, v.to), v.allowed, `${v.from}->${v.to}`);
  assertEquals([PaymentStateMachine.fromProvider('APPROVED'), PaymentStateMachine.fromProvider('PENDING')], ['approved', null]);
});

Deno.test('integrity signature: the documented vector, and expiration is signed too', async () => {
  const checkout = { reference: 'sk8-438k4-xmxm392-sn2m', amount: Money.fromCents(2490000), expirationTime: null };
  assertEquals(await IntegritySignature.sign(checkout, DOC_INTEGRITY_SECRET),
    '37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5');
  const expiring = { ...checkout, expirationTime: '2023-06-09T20:28:50.000Z' };
  assertEquals(await IntegritySignature.sign(expiring, DOC_INTEGRITY_SECRET), await sha256Hex(
    `sk8-438k4-xmxm392-sn2m2490000COP2023-06-09T20:28:50.000Z${DOC_INTEGRITY_SECRET}`));
});

Deno.test('credentials need WOMPI_ENV and keys with the prefix of that environment', () => {
  const factory = (secrets: Record<string, string>) => new MerchantCredentialsFactory((n) => secrets[n]).forPlatform();
  assertEquals(factory(sandboxSecrets())?.environment, 'test');
  assertEquals(factory({ ...sandboxSecrets(), WOMPI_ENV: 'prod' }), null);
  assertEquals(factory({ ...sandboxSecrets(), WOMPI_ENV: 'staging' }), null);
  assertEquals(factory({ ...sandboxSecrets(), WOMPI_PRIVATE_KEY: ['prv', 'prod', 'x'].join('_') }), null);
  assertEquals(factory({ ...sandboxSecrets(), WOMPI_EVENTS_SECRET: ['test', 'events', ''].join('_') }), null);
  const { WOMPI_INTEGRITY_SECRET: _omitted, ...missing } = sandboxSecrets();
  assertEquals(factory(missing), null);
});

Deno.test('the checkout URL carries every documented parameter and a signature over them', async () => {
  const credentials = new MerchantCredentialsFactory((n) => sandboxSecrets()[n]).forPlatform()!;
  const url = new URL(await new CheckoutUrlBuilder(credentials)
    .withReference('luma_abc').withAmount(Money.fromPesos(12000))
    .withRedirectUrl('luma://payments/return?order=o1').expiringAt(new Date('2026-10-24T15:00:00Z')).build());
  assertEquals(url.origin + url.pathname, 'https://checkout.wompi.co/p/');
  const q = Object.fromEntries(url.searchParams);
  assertEquals(q['public-key'], sandboxSecrets().WOMPI_PUBLIC_KEY);
  assertEquals([q.currency, q['amount-in-cents'], q.reference], ['COP', '1200000', 'luma_abc']);
  assertEquals(q['expiration-time'], '2026-10-24T15:00:00.000Z');
  assertEquals(q['signature:integrity'], await sha256Hex(
    `luma_abc1200000COP2026-10-24T15:00:00.000Z${sandboxSecrets().WOMPI_INTEGRITY_SECRET}`));
  assertEquals(url.toString().includes(sandboxSecrets().WOMPI_INTEGRITY_SECRET), false);
  assertEquals(url.toString().includes(sandboxSecrets().WOMPI_PRIVATE_KEY), false);
  await assertRejects(() => new CheckoutUrlBuilder(credentials).withReference('x').build());
});

Deno.test('payment logs keep only short codes and counts', () => {
  const lines: string[] = [];
  const log = new PaymentLog((line) => lines.push(line));
  log.info('event_rejected', { step: 'checksum', count: 2.7 });
  log.info('juan@example.com', { outcome: 'prv_test_secret value', step: '+57 300 123 4567' });
  assertEquals(lines, [
    '{"event":"event_rejected","step":"checksum","count":2}',
    '{"event":"redacted","outcome":"redacted","step":"redacted"}',
  ]);
});
