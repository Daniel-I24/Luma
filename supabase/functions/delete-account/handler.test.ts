import { assertEquals } from '@std/assert';

import { extractBearerToken } from './handler.ts';
import {
  APP_ORIGIN,
  CALLER_ID,
  VALID_TOKEN,
  handlerFor,
  minutesAgo,
  request,
} from './handler.test-helper.ts';

Deno.test('rejects methods other than POST and OPTIONS with 405', async () => {
  const { handler, deleted } = handlerFor();
  for (const method of ['GET', 'PUT', 'DELETE']) {
    const res = await handler(request(method, { Authorization: `Bearer ${VALID_TOKEN}` }));
    assertEquals(res.status, 405);
    assertEquals(await res.json(), { error: 'method_not_allowed' });
  }
  assertEquals(deleted, []);
});

Deno.test('answers the CORS preflight for an allowed origin', async () => {
  const { handler } = handlerFor();
  const res = await handler(request('OPTIONS'));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), APP_ORIGIN);
});

Deno.test('rejects origins outside the allow list and never answers with *', async () => {
  const { handler, deleted } = handlerFor();
  const res = await handler(
    request('POST', { Origin: 'https://evil.example', Authorization: `Bearer ${VALID_TOKEN}` }),
  );
  assertEquals(res.status, 403);
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), null);
  assertEquals(deleted, []);
});

Deno.test('returns 401 without a token', async () => {
  const { handler, deleted } = handlerFor();
  const res = await handler(request('POST'));
  assertEquals(res.status, 401);
  assertEquals(await res.json(), { error: 'unauthorized' });
  assertEquals(deleted, []);
});

Deno.test('returns 401 with an invalid token', async () => {
  const { handler, deleted } = handlerFor();
  const res = await handler(request('POST', { Authorization: 'Bearer forged-token' }));
  assertEquals(res.status, 401);
  assertEquals(await res.json(), { error: 'unauthorized' });
  assertEquals(deleted, []);
});

Deno.test('deletes only the caller, ignoring any id in the body or URL', async () => {
  const { handler, deleted } = handlerFor();
  const res = await handler(
    request(
      'POST',
      { Authorization: `Bearer ${VALID_TOKEN}` },
      JSON.stringify({ user_id: 'victim-id' }),
    ),
  );
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { deleted: true });
  assertEquals(deleted, [CALLER_ID]);
});

Deno.test('returns a generic 500 when the deletion fails', async () => {
  const { handler } = handlerFor({ deleteError: new Error('db exploded: secret detail') });
  const res = await handler(request('POST', { Authorization: `Bearer ${VALID_TOKEN}` }));
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'delete_failed' });
});

Deno.test('returns a generic 500 when Auth is unreachable', async () => {
  const { handler, deleted } = handlerFor({ throwOnGetUser: true });
  const res = await handler(request('POST', { Authorization: `Bearer ${VALID_TOKEN}` }));
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'delete_failed' });
  assertEquals(deleted, []);
});

Deno.test('deletes the caller files before the account', async () => {
  const { handler, deleted, removed } = handlerFor({
    businesses: { [CALLER_ID]: ['b1'] },
    files: { 'business-images/b1/logo': ['l.webp'], 'verification-docs/b1/rut': ['r.pdf'] },
  });
  const res = await handler(request('POST', { Authorization: `Bearer ${VALID_TOKEN}` }));
  assertEquals(res.status, 200);
  assertEquals(removed, ['business-images/b1/logo/l.webp', 'verification-docs/b1/rut/r.pdf']);
  assertEquals(deleted, [CALLER_ID]);
});

Deno.test('keeps the account when its pictures cannot be deleted', async () => {
  const { handler, deleted } = handlerFor({
    businesses: { [CALLER_ID]: ['b1'] },
    files: { 'business-images/b1/logo': ['l.webp'] },
    failRemove: true,
  });
  const res = await handler(request('POST', { Authorization: `Bearer ${VALID_TOKEN}` }));
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'delete_failed' });
  assertEquals(deleted, []);
});

for (const [label, signedInAt] of [
  ['more than 10 minutes ago', minutesAgo(11)],
  ['never', null],
  ['at an unreadable time', 'not-a-date'],
] as const) {
  Deno.test(`asks to sign in again when the last sign-in was ${label}`, async () => {
    const { handler, deleted, removed } = handlerFor({
      signedInAt,
      businesses: { [CALLER_ID]: ['b1'] },
      files: { 'business-images/b1/logo': ['l.webp'] },
    });
    const res = await handler(request('POST', { Authorization: `Bearer ${VALID_TOKEN}` }));
    assertEquals(res.status, 403);
    assertEquals(await res.json(), { error: 'reauth_required' });
    assertEquals(deleted, []);
    assertEquals(removed, []);
  });
}

Deno.test('accepts a sign-in exactly 10 minutes old', async () => {
  const { handler, deleted } = handlerFor({ signedInAt: minutesAgo(10) });
  const res = await handler(request('POST', { Authorization: `Bearer ${VALID_TOKEN}` }));
  assertEquals(res.status, 200);
  assertEquals(deleted, [CALLER_ID]);
});

Deno.test('extracts only well-formed bearer tokens', () => {
  assertEquals(extractBearerToken(null), null);
  assertEquals(extractBearerToken('Basic abc'), null);
  assertEquals(extractBearerToken('Bearer '), null);
  assertEquals(extractBearerToken('Bearer abc'), 'abc');
});
