import assert from 'node:assert/strict';
import { test } from 'node:test';
import { plan, readSmokeEnv, runSmoke, SmokeError, summarize } from './ai-smoke.mjs';

const ENV = {
  SUPABASE_URL: 'https://abcd.supabase.co/',
  SUPABASE_ANON_KEY: 'anon',
  SMOKE_EMAIL: 'test@example.com',
  SMOKE_PASSWORD: 'secret-password',
};

test('needs the four variables and https', () => {
  assert.throws(() => readSmokeEnv({}), SmokeError);
  assert.throws(() => readSmokeEnv({ ...ENV, SUPABASE_URL: 'http://x' }), /https/);
  assert.equal(readSmokeEnv(ENV).url, 'https://abcd.supabase.co');
});

test('extract-menu runs only with a business id and --menu', () => {
  assert.deepEqual(plan(readSmokeEnv(ENV, ['--menu'])).map((c) => c.name), ['recommend']);
  const withBusiness = { ...ENV, SMOKE_BUSINESS_ID: 'b1' };
  assert.deepEqual(plan(readSmokeEnv(withBusiness)).map((c) => c.name), ['recommend', 'suggest-promotions']);
  assert.deepEqual(plan(readSmokeEnv(withBusiness, ['--menu'])).map((c) => c.name), [
    'recommend',
    'suggest-promotions',
    'extract-menu',
  ]);
});

test('summaries show shapes and error codes, never texts', () => {
  assert.equal(
    summarize('recommend', 200, { businesses: [{ id: 'x', reason: 'nearby' }], combo: null }).line,
    'ok   recommend: 200 businesses=1 combo=no',
  );
  assert.equal(summarize('extract-menu', 200, { items: [{ name: 'Secret dish' }] }).line, 'ok   extract-menu: 200 items=1');
  const failed = summarize('recommend', 503, { error: 'ai_unavailable', detail: 'key=abc' });
  assert.deepEqual(failed, { ok: false, line: 'FAIL recommend: 503 error=ai_unavailable' });
});

test('signs in, calls each function with the token and never logs it', async () => {
  const seen = [];
  const lines = [];
  const fetchFn = (url, init) => {
    seen.push([url, init.headers.authorization ?? null]);
    if (url.includes('/auth/v1/token')) return Promise.resolve(Response.json({ access_token: 'tok-123' }));
    return Promise.resolve(Response.json({ source: 'rules', ideas: [] }, { status: url.endsWith('recommend') ? 503 : 200 }));
  };
  const failures = await runSmoke(readSmokeEnv({ ...ENV, SMOKE_BUSINESS_ID: 'b1' }), fetchFn, (l) => lines.push(l));
  assert.equal(failures, 1);
  assert.deepEqual(seen.slice(1).map(([, auth]) => auth), ['Bearer tok-123', 'Bearer tok-123']);
  assert.equal(lines.join('\n').includes('tok-123'), false);
  assert.equal(lines.join('\n').includes('secret-password'), false);
});

test('a failed sign-in is a clear error', async () => {
  const fetchFn = () => Promise.resolve(Response.json({ error: 'invalid_grant' }, { status: 400 }));
  await assert.rejects(runSmoke(readSmokeEnv(ENV), fetchFn, () => undefined), /Sign-in failed \(400\)/);
});
