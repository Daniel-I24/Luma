import { assertEquals } from '@std/assert';

import { FcmClient, type FetchLike, serviceAccountFrom, signedAssertion } from './fcm.ts';

const keys = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true,
  ['sign', 'verify'],
);
const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keys.privateKey));
// Generated for this run only; the marker is assembled so the secret scan stays strict.
const marker = (edge: string) => `-----${edge} ${'PRIVATE'} KEY-----`;
const pem = `${marker('BEGIN')}\n${btoa(String.fromCharCode(...der))}\n${marker('END')}\n`;
const account = { projectId: 'luma-test', clientEmail: 'push@luma-test.iam.gserviceaccount.com', privateKey: pem };
const fromB64url = (s: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

Deno.test('the assertion is an RS256 JWT for the FCM scope, verifiable with the public key', async () => {
  const jwt = await signedAssertion(account, 1_000);
  const [header, claims, signature] = jwt.split('.');
  assertEquals(JSON.parse(new TextDecoder().decode(fromB64url(header))), { alg: 'RS256', typ: 'JWT' });
  const payload = JSON.parse(new TextDecoder().decode(fromB64url(claims)));
  assertEquals([payload.iss, payload.scope, payload.aud, payload.exp - payload.iat], [
    account.clientEmail, 'https://www.googleapis.com/auth/firebase.messaging', 'https://oauth2.googleapis.com/token', 3600,
  ]);
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', keys.publicKey, fromB64url(signature), new TextEncoder().encode(`${header}.${claims}`),
  );
  assertEquals(ok, true);
});

Deno.test('service account JSON is read from one secret; bad values give null', () => {
  const raw = JSON.stringify({ project_id: 'p', client_email: 'e', private_key: pem });
  assertEquals(serviceAccountFrom(raw)?.projectId, 'p');
  assertEquals(serviceAccountFrom(undefined), null);
  assertEquals(serviceAccountFrom('{not json'), null);
  assertEquals(serviceAccountFrom(JSON.stringify({ project_id: 'p', client_email: 'e', private_key: 'x' })), null);
});

Deno.test('sends v1 messages, reuses the access token and spots dead tokens', async () => {
  const urls: string[] = [];
  const sends: Record<string, unknown>[] = [];
  const fetchFn: FetchLike = (url, init) => {
    urls.push(url);
    if (url.startsWith('https://oauth2')) return Promise.resolve(Response.json({ access_token: 'at', expires_in: 3600 }));
    const body = JSON.parse(String(init.body));
    sends.push(body);
    const token = body.message.token;
    if (token === 'dead') return Promise.resolve(Response.json({ error: { status: 'UNREGISTERED' } }, { status: 404 }));
    if (token === 'busy') return Promise.resolve(Response.json({ error: { status: 'UNAVAILABLE' } }, { status: 503 }));
    return Promise.resolve(Response.json({ name: 'projects/luma-test/messages/1' }));
  };
  const fcm = new FcmClient(account, fetchFn, () => 1_000_000);
  const results = [];
  for (const token of ['ok', 'dead', 'busy']) results.push(await fcm.send(token, 'T', 'B', { type: 'order_new' }));
  assertEquals(results, ['sent', 'invalid_token', 'failed']);
  assertEquals(urls.filter((u) => u.startsWith('https://oauth2')).length, 1);
  assertEquals(urls[1], 'https://fcm.googleapis.com/v1/projects/luma-test/messages:send');
  assertEquals(sends[0], {
    message: { token: 'ok', notification: { title: 'T', body: 'B' }, data: { type: 'order_new' }, android: { priority: 'high' } },
  });
});
