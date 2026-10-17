import { assertEquals } from '@std/assert';

import { extractBearerToken } from './handler.ts';
import { APP_ORIGIN, CALLER_ID, VALID_TOKEN, handlerFor, request } from './handler.test-helper.ts';

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

Deno.test('deletes the caller pictures before the account', async () => {
  const { handler, deleted, removed } = handlerFor({
    businesses: { [CALLER_ID]: ['b1'] },
    files: { 'b1/logo': ['l.webp'] },
  });
  const res = await handler(request('POST', { Authorization: `Bearer ${VALID_TOKEN}` }));
  assertEquals(res.status, 200);
  assertEquals(removed, ['b1/logo/l.webp']);
  assertEquals(deleted, [CALLER_ID]);
});

Deno.test('keeps the account when its pictures cannot be deleted', async () => {
  const { handler, deleted } = handlerFor({
    businesses: { [CALLER_ID]: ['b1'] },
    files: { 'b1/logo': ['l.webp'] },
    failRemove: true,
  });
  const res = await handler(request('POST', { Authorization: `Bearer ${VALID_TOKEN}` }));
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'delete_failed' });
  assertEquals(deleted, []);
});

Deno.test('extracts only well-formed bearer tokens', () => {
  assertEquals(extractBearerToken(null), null);
  assertEquals(extractBearerToken('Basic abc'), null);
  assertEquals(extractBearerToken('Bearer '), null);
  assertEquals(extractBearerToken('Bearer abc'), 'abc');
});
