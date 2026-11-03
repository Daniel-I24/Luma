import { assertEquals } from '@std/assert';

import { createHandler } from './handler.ts';
import { extractCode, textMessages } from './payload.ts';
import { constantTimeEqual, validSignature } from './signature.ts';

const SECRET = 'app-secret-for-tests';
const TOKEN = 'verify-token-for-tests';

async function sign(body: string, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  return 'sha256=' + Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The shape of Meta's "text message" payload example. */
const delivery = (messages: unknown[]) =>
  JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: '1', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', messages } }] }],
  });
const text = (id: string, from: string, body: string) => ({ id, from, timestamp: '1749416383', type: 'text', text: { body } });

function setup(options: { secret?: string | null; token?: string | null } = {}) {
  const calls: { messageId: string; senderHash: string; sender: string; code: string }[] = [];
  const handler = createHandler({
    verifyToken: options.token === undefined ? TOKEN : options.token,
    appSecret: options.secret === undefined ? SECRET : options.secret,
    verify: (input) => {
      calls.push(input);
      return Promise.resolve('verified');
    },
  });
  return { handler, calls };
}
const post = async (body: string, signature?: string) =>
  new Request('http://localhost/functions/v1/whatsapp-webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature ?? (await sign(body)) },
    body,
  });

Deno.test('subscription: answers hub.challenge only with the verify token', async () => {
  const { handler } = setup();
  const good = await handler(new Request(`http://x/?hub.mode=subscribe&hub.verify_token=${TOKEN}&hub.challenge=1158201444`));
  assertEquals([good.status, await good.text()], [200, '1158201444']);
  assertEquals((await handler(new Request('http://x/?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1'))).status, 403);
  assertEquals((await setup({ token: null }).handler(new Request(`http://x/?hub.mode=subscribe&hub.verify_token=${TOKEN}&hub.challenge=1`))).status, 403);
});

Deno.test('a valid signature: each text code goes to the database with a hash of the sender', async () => {
  const { handler, calls } = setup();
  const res = await handler(await post(delivery([text('wamid.A', '573001112233', 'Hola, mi código es LUMA-AB12CD')])));
  assertEquals(res.status, 200);
  assertEquals(calls.length, 1);
  assertEquals([calls[0].messageId, calls[0].sender, calls[0].code], ['wamid.A', '573001112233', 'LUMA-AB12CD']);
  assertEquals(/^[0-9a-f]{64}$/.test(calls[0].senderHash) && !calls[0].senderHash.includes('573001112233'), true);
});

Deno.test('an invalid or missing signature, or a tampered body, is refused before reading it', async () => {
  const { handler, calls } = setup();
  const body = delivery([text('wamid.B', '573001112233', 'LUMA-AB12CD')]);
  assertEquals((await handler(await post(body, await sign(body, 'other-secret')))).status, 401);
  assertEquals((await handler(await post(body, 'sha256=nothex'))).status, 401);
  const tampered = body.replace('573001112233', '573009999999');
  assertEquals((await handler(await post(tampered, await sign(body)))).status, 401);
  assertEquals(calls.length, 0);
});

Deno.test('without secrets it does nothing (and says 200 so Meta does not insist)', async () => {
  const { handler, calls } = setup({ secret: null });
  assertEquals((await handler(await post(delivery([text('wamid.C', '573001112233', 'LUMA-AB12CD')])))).status, 200);
  assertEquals(calls.length, 0);
});

Deno.test('the same delivery twice passes the id both times: the database keeps it idempotent', async () => {
  const { handler, calls } = setup();
  const body = delivery([text('wamid.D', '573001112233', 'LUMA-AB12CD')]);
  await handler(await post(body));
  await handler(await post(body));
  assertEquals(calls.map((c) => c.messageId), ['wamid.D', 'wamid.D']);
});

Deno.test('only text messages with a strict code; statuses, media and odd senders are ignored', () => {
  const messages = textMessages(JSON.parse(delivery([
    text('1', '573001112233', 'luma-ab12cd por favor'),
    text('2', '573001112233', 'sin código'),
    text('3', '+57 300', 'LUMA-AB12CD'),
    { id: '4', from: '573001112233', type: 'image', image: {} },
  ])));
  assertEquals(messages.map((m) => [m.id, m.code]), [['1', 'LUMA-AB12CD'], ['2', null]]);
  assertEquals(textMessages({ object: 'page', entry: [] }), []);
  assertEquals(extractCode('XLUMA-AB12CDE'), null);
  assertEquals(extractCode('código: LUMA-AB12C'), null);
  assertEquals(extractCode('(LUMA-0A1B2C)'), 'LUMA-0A1B2C');
});

Deno.test('signature helpers', async () => {
  const raw = new TextEncoder().encode('{}');
  assertEquals(await validSignature(SECRET, raw, await sign('{}')), true);
  assertEquals(await validSignature(SECRET, raw, null), false);
  assertEquals(constantTimeEqual('abc', 'abd'), false);
  assertEquals(constantTimeEqual('abc', 'abc'), true);
});
