import { assertEquals, assertRejects } from '@std/assert';

import { PaymentEventVerifier, type TransactionSource } from './payment-event-verifier.ts';
import {
  DOC_EVENTS_SECRET, FakePaymentRepository, sandboxCredentials, sandboxSecrets, signedEvent, transaction,
} from './payments.test-helper.ts';
import { sha256Hex } from '../secure-compare.ts';
import { WompiApi, WompiUnavailable } from './wompi-api.ts';
import { EventChecksum, type EventTransaction, WompiEventParser } from './wompi-event.ts';

function setup(api: Partial<Record<string, EventTransaction | null>> = { [transaction().id]: transaction() }) {
  const repository = new FakePaymentRepository();
  const calls: string[] = [];
  const source: TransactionSource = {
    transaction: (id) => Promise.resolve(void calls.push(id)).then(() => api[id] ?? null),
  };
  const verifier = new PaymentEventVerifier({
    environment: 'test', eventsSecret: sandboxSecrets().WOMPI_EVENTS_SECRET, repository, api: source,
  });
  return { verifier, repository, calls };
}

Deno.test('checksum follows the documented steps (values in order, timestamp, events secret)', async () => {
  const event = WompiEventParser.parse(await signedEvent(transaction({ amountInCents: 4490000 }),
    { secret: DOC_EVENTS_SECRET, environment: 'prod' }))!;
  const expected = await sha256Hex(`1234-1610641025-49201APPROVED44900001530291411${DOC_EVENTS_SECRET}`);
  assertEquals(await EventChecksum.compute(event, DOC_EVENTS_SECRET), expected);
  assertEquals(expected.toUpperCase(), '5A18EC5E8FDB7DF463E9F94774CBA8F583BA21BD04A09CEFF2EA68A4BC0AEFBE');
  assertEquals(await EventChecksum.verify(event, DOC_EVENTS_SECRET), true);
  assertEquals(await EventChecksum.verify(event, sandboxSecrets().WOMPI_EVENTS_SECRET), false);
});

Deno.test('a valid, confirmed and matching event is applied with the API values', async () => {
  const { verifier, repository, calls } = setup();
  assertEquals(await verifier.verify(await signedEvent()), { kind: 'done', outcome: 'applied' });
  assertEquals(calls, [transaction().id]);
  assertEquals(repository.applied[0], {
    reference: 'luma_ref', transactionId: transaction().id, status: 'APPROVED', amountInCents: 1200000,
    currency: 'COP', environment: 'test', paymentMethodType: 'CARD', source: 'webhook',
  });
});

Deno.test('tampered data, a wrong secret or a wrong environment never reach the database', async () => {
  const { verifier, repository, calls } = setup();
  const tampered = await signedEvent();
  (tampered.data as { transaction: Record<string, unknown> }).transaction.amount_in_cents = 1;
  assertEquals(await verifier.verify(tampered), { kind: 'reject', step: 'checksum' });
  assertEquals(await verifier.verify(await signedEvent(transaction(), { secret: 'test_events_other' })),
    { kind: 'reject', step: 'checksum' });
  assertEquals(await verifier.verify(await signedEvent(transaction(), { environment: 'prod' })),
    { kind: 'reject', step: 'schema' });
  for (const body of [null, 'x', [], { event: 'transaction.updated' }]) {
    assertEquals((await verifier.verify(body)).kind, 'reject');
  }
  assertEquals([calls.length, repository.applied.length], [0, 0]);
});

Deno.test('a repeated event stops before the API; an old event is still processed', async () => {
  const { verifier, calls } = setup();
  assertEquals((await verifier.verify(await signedEvent(transaction(), { timestamp: 1 }))).kind, 'done');
  assertEquals(await verifier.verify(await signedEvent()), { kind: 'done', outcome: 'duplicate' });
  assertEquals(calls.length, 1);
});

Deno.test('an unknown transaction, or one with another reference, is rejected', async () => {
  assertEquals(await setup({}).verifier.verify(await signedEvent()), { kind: 'reject', step: 'api' });
  const other = setup({ [transaction().id]: transaction({ reference: 'luma_other' }) });
  assertEquals(await other.verifier.verify(await signedEvent()), { kind: 'reject', step: 'api' });
});

Deno.test('the API decides: a fake APPROVED event of a declined transaction applies DECLINED', async () => {
  const { verifier, repository } = setup({ [transaction().id]: transaction({ status: 'DECLINED' }) });
  await verifier.verify(await signedEvent());
  assertEquals(repository.applied[0].status, 'DECLINED');
});

Deno.test('amount, currency or reference that do not match the attempt are mismatches', async () => {
  const amount = setup({ [transaction().id]: transaction({ amountInCents: 100 }) });
  assertEquals(await amount.verifier.verify(await signedEvent()), { kind: 'done', outcome: 'mismatch' });
  const currency = setup({ [transaction().id]: transaction({ currency: 'USD' }) });
  assertEquals(await currency.verifier.verify(await signedEvent()), { kind: 'done', outcome: 'mismatch' });
  const unknown = transaction({ reference: 'luma_nobody' });
  const missing = setup({ [unknown.id]: unknown });
  assertEquals(await missing.verifier.verify(await signedEvent(unknown)), { kind: 'done', outcome: 'unknown_reference' });
});

Deno.test('other signed event types are acknowledged and ignored', async () => {
  const { verifier, repository } = setup();
  const event = await signedEvent();
  event.event = 'nequi_token.updated';
  assertEquals(await verifier.verify(event), { kind: 'done', outcome: 'not_a_transaction' });
  assertEquals(repository.applied.length, 0);
});

Deno.test('WompiApi: private key, sandbox URL, 404 is null, 5xx and network errors are unavailable', async () => {
  const seen: [string, string | null][] = [];
  const answers: Record<string, Response | Error> = {
    ok: Response.json({ data: { ...apiBody(transaction()) } }), gone: new Response('{}', { status: 404 }),
    down: new Response('', { status: 503 }), net: new Error('offline'), bad: Response.json({ data: { id: 'bad' } }),
  };
  const api = new WompiApi(sandboxCredentials(), (url, init) => {
    seen.push([url, new Headers(init.headers).get('authorization')]);
    const key = url.split('/').at(-1)!;
    const answer = answers[key];
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  });
  answers[transaction().id] = answers.ok;
  assertEquals((await api.transaction(transaction().id))?.status, 'APPROVED');
  assertEquals(seen[0], [`https://sandbox.wompi.co/v1/transactions/${transaction().id}`, `Bearer ${sandboxSecrets().WOMPI_PRIVATE_KEY}`]);
  assertEquals(await api.transaction('gone'), null);
  for (const id of ['down', 'net', 'bad']) await assertRejects(() => api.transaction(id), WompiUnavailable);
});

function apiBody(tx: EventTransaction): Record<string, unknown> {
  return {
    id: tx.id, reference: tx.reference, status: tx.status, amount_in_cents: tx.amountInCents,
    currency: tx.currency, payment_method_type: tx.paymentMethodType,
  };
}
