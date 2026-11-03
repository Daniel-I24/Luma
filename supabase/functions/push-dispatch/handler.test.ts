import { assertEquals } from '@std/assert';

import type { SendResult } from './fcm.ts';
import { BATCH, createHandler, sameSecret } from './handler.ts';
import { cleanName, type PushRow, pushText } from './messages.ts';

const SECRET = 's'.repeat(40);
const row = (n: number, tokens = ['t-ok']): PushRow => ({
  notification_id: `n${n}`, type: 'order_status', status: 'ready', order_id: `o${n}`, business_name: 'Café Público', tokens,
});

function setup(options: { batches?: PushRow[][]; sender?: boolean; results?: Record<string, SendResult> } = {}) {
  const batches = [...(options.batches ?? [[row(1, ['t-ok', 't-dead'])]])];
  const sent: [string, string, Record<string, string>][] = [];
  const removed: string[][] = [];
  const handler = createHandler({
    secret: SECRET,
    store: {
      claim: () => Promise.resolve(batches.shift() ?? []),
      removeTokens: (tokens) => Promise.resolve(void removed.push(tokens)),
    },
    sender: options.sender === false ? null : {
      send: (token, _title, body, data) => {
        sent.push([token, body, data]);
        return Promise.resolve(options.results?.[token] ?? (token === 't-dead' ? 'invalid_token' : 'sent'));
      },
    },
  });
  return { handler, sent, removed, batches };
}

const poke = (secret: string | null = SECRET, method = 'POST') =>
  new Request('http://localhost/functions/v1/push-dispatch', {
    method,
    headers: secret === null ? {} : { 'x-push-secret': secret },
    body: method === 'POST' ? '{}' : undefined,
  });

Deno.test('sends each claimed notification to every token and removes dead tokens', async () => {
  const { handler, sent, removed } = setup();
  const res = await handler(poke());
  assertEquals([res.status, await res.json()], [200, { sent: 1, removed: 1 }]);
  assertEquals(sent[0], ['t-ok', 'Tu pedido en Café Público está listo para recoger.', { type: 'order_status', notification_id: 'n1', order_id: 'o1' }]);
  assertEquals(removed, [['t-dead']]);
});

Deno.test('only the database may call it (shared secret, POST)', async () => {
  const { handler, sent } = setup();
  assertEquals((await handler(poke(null))).status, 401);
  assertEquals((await handler(poke('s'.repeat(39)))).status, 401);
  assertEquals((await handler(poke(SECRET, 'GET'))).status, 405);
  assertEquals(sent.length, 0);
  assertEquals([sameSecret(SECRET, SECRET), sameSecret('', SECRET), sameSecret(SECRET + 'x', SECRET)], [true, false, false]);
});

Deno.test('without FCM secrets nothing is claimed (503)', async () => {
  const { handler, batches } = setup({ sender: false });
  assertEquals((await handler(poke())).status, 503);
  assertEquals(batches.length, 1);
});

Deno.test('full batches keep claiming, up to five per poke', async () => {
  const full = Array.from({ length: BATCH }, (_, n) => row(n));
  const { handler, sent } = setup({ batches: [full, full, full, full, full, full] });
  assertEquals((await (await handler(poke())).json()).sent, 5 * BATCH);
  assertEquals(sent.length, 5 * BATCH);
});

Deno.test('texts are Spanish, use only the public business name and skip unknown types', () => {
  assertEquals(pushText({ ...row(1), type: 'order_new' })?.title, 'Nuevo pedido');
  assertEquals(pushText({ ...row(1), type: 'promotion', business_name: 'Tienda\u0000<b>X</b>' })?.body, 'Tienda b X /b tiene una promoción nueva.');
  assertEquals(pushText({ ...row(1), type: 'business_review', status: 'approved' })?.title, 'Negocio aprobado');
  assertEquals(pushText({ ...row(1), status: 'weird' }), null);
  assertEquals(pushText({ ...row(1), type: 'other' }), null);
  assertEquals(cleanName(null), 'Luma');
  assertEquals(cleanName('x'.repeat(60)).length, 40);
});
