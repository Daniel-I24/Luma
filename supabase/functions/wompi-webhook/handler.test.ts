import { assertEquals } from '@std/assert';

import { PaymentEventVerifier } from '../_shared/payments/payment-event-verifier.ts';
import { PaymentLog } from '../_shared/payments/payment-log.ts';
import {
  FakePaymentRepository, sandboxSecrets, signedEvent, transaction,
} from '../_shared/payments/payments.test-helper.ts';
import type { EventTransaction } from '../_shared/payments/wompi-event.ts';
import { createHandler, MAX_EVENT_BYTES } from './handler.ts';

function setup(api: Record<string, EventTransaction | null> = { [transaction().id]: transaction() }, configured = true) {
  const repository = new FakePaymentRepository();
  const logs: string[] = [];
  const verifier = new PaymentEventVerifier({
    environment: 'test', eventsSecret: sandboxSecrets().WOMPI_EVENTS_SECRET, repository,
    api: { transaction: (id) => Promise.resolve(api[id] ?? null) },
  });
  const handler = createHandler({ verifier: configured ? verifier : null, log: new PaymentLog((l) => logs.push(l)) });
  return { handler, repository, logs };
}

const post = (body: BodyInit, headers: Record<string, string> = { 'Content-Type': 'application/json' }) =>
  new Request('http://localhost/functions/v1/wompi-webhook', { method: 'POST', headers, body });

Deno.test('a valid event is applied and answered 200 only after processing', async () => {
  const { handler, repository } = setup();
  const res = await handler(post(JSON.stringify(await signedEvent())));
  assertEquals([res.status, await res.text()], [200, '{}']);
  assertEquals(repository.applied.length, 1);
});

Deno.test('every rejection answers the same, without details', async () => {
  const { handler, repository } = setup();
  const good = JSON.stringify(await signedEvent());
  const answers = [
    await handler(post(good, { 'Content-Type': 'text/plain' })),
    await handler(new Request('http://localhost/x', { method: 'GET' })),
    await handler(post('{"event": ')),
    await handler(post(JSON.stringify(await signedEvent(transaction(), { secret: 'test_events_wrong' })))),
    await handler(post('x'.repeat(MAX_EVENT_BYTES + 1))),
    await handler(post(good, { 'Content-Type': 'application/json', 'Content-Length': String(10 * MAX_EVENT_BYTES) })),
  ];
  for (const res of answers) assertEquals([res.status, await res.text()], [400, '{}']);
  assertEquals(repository.applied.length, 0);
});

Deno.test('an unknown transaction is rejected; a repeated event is acknowledged once processed', async () => {
  const unknown = setup({});
  assertEquals((await unknown.handler(post(JSON.stringify(await signedEvent())))).status, 400);
  const { handler, repository } = setup();
  const body = JSON.stringify(await signedEvent());
  await handler(post(body));
  assertEquals((await handler(post(body))).status, 200);
  assertEquals(repository.applied.length, 1);
});

Deno.test('missing secrets reject everything', async () => {
  const { handler } = setup(undefined, false);
  assertEquals((await handler(post(JSON.stringify(await signedEvent())))).status, 400);
});

Deno.test('no log line carries secrets, ids, references or personal data', async () => {
  const { handler, logs } = setup();
  await handler(post(JSON.stringify(await signedEvent())));
  await handler(post(JSON.stringify(await signedEvent(transaction(), { secret: 'test_events_wrong' }))));
  const text = logs.join('\n');
  for (const forbidden of [...Object.values(sandboxSecrets()).slice(1), transaction().id, 'luma_ref', 'juan.perez', '@']) {
    assertEquals(text.includes(forbidden), false, forbidden);
  }
  assertEquals(logs.length, 2);
});
