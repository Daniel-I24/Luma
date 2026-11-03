import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { EXPECTED, PLACEHOLDERS, rpcBody } from './verify-backend.expected.mjs';
import {
  VerifyError, functionVerdict, privateBucketVerdict, readEnv, rpcVerdict, tableVerdict, verify,
} from './verify-backend.mjs';

const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon-key-123' };
const denied = () => Response.json({ code: '42501', message: 'permission denied for function' }, { status: 401 });

/**
 * A fake project that behaves like PostgREST: an RPC with required parameters
 * that is called without them answers PGRST202, exactly as a missing one does.
 */
function fakeProject(overrides = {}) {
  const calls = [];
  const fetchFn = async (url, init = {}) => {
    calls.push({ url, init });
    for (const [part, answer] of Object.entries(overrides)) if (url.includes(part)) return answer(url, init);
    const rpc = url.match(/\/rest\/v1\/rpc\/(\w+)$/)?.[1];
    if (rpc) {
      const sent = JSON.parse(init.body ?? '{}');
      const complete = Object.keys(EXPECTED.rpcs[rpc] ?? {}).every((name) => name in sent);
      return complete ? denied() : Response.json({ code: 'PGRST202' }, { status: 404 });
    }
    if (url.includes('/functions/v1/')) return new Response(null, { status: 200 });
    if (url.includes('/rest/v1/business_photos?select=storage_path')) return Response.json([{ storage_path: 'b1/gallery/p.webp' }]);
    if (url.includes('/object/public/business-images/b1/gallery/p.webp')) return new Response('img', { status: 200 });
    if (url.includes('/object/public/')) return Response.json({ statusCode: '404', error: 'not_found', message: 'Bucket not found' }, { status: 400 });
    return Response.json([], { status: 200 });
  };
  return { fetchFn, calls };
}
const failures = (lines) => lines.filter((l) => !l.ok).map((l) => l.line);

test('needs https, refuses secret keys and reads --expect-deployed', () => {
  assert.throws(() => readEnv({}), VerifyError);
  assert.throws(() => readEnv({ SUPABASE_URL: 'http://x', SUPABASE_ANON_KEY: 'k' }), /https/);
  assert.throws(() => readEnv({ SUPABASE_URL: 'https://x', SUPABASE_ANON_KEY: 'sb_secret_abc' }), /never a secret/);
  assert.deepEqual(readEnv(ENV).expectDeployed, []);
  assert.deepEqual(readEnv(ENV, ['--expect-deployed=delete-account, geocode']).expectDeployed, ['delete-account', 'geocode']);
  assert.throws(() => readEnv(ENV, ['--expect-deployed=nope']), /Unknown function/);
});

test('verdicts: missing apart from protected, failing apart from not deployed', () => {
  assert.equal(tableVerdict(200, []), 'ok');
  assert.equal(tableVerdict(401, { code: '42501' }), 'ok (private)');
  assert.equal(tableVerdict(404, { code: 'PGRST205' }), 'missing table');
  assert.equal(tableVerdict(400, { code: '42703' }), 'missing column');
  assert.equal(rpcVerdict(404, { code: 'PGRST202' }), 'missing');
  for (const [status, code] of [[401, '42501'], [403, null], [400, '42501']]) assert.equal(rpcVerdict(status, { code }), 'ok (protected)');
  assert.equal(rpcVerdict(200, []), 'callable by anon');
  assert.equal(rpcVerdict(503, null), 'unknown (503)');
  assert.deepEqual([404, 503, 546, 204, 405].map(functionVerdict),
    ['not deployed', 'deployed but failing', 'deployed but failing', 'deployed', 'deployed']);
  assert.equal(privateBucketVerdict(400, { message: 'Bucket not found' }), 'ok (private)');
  assert.equal(privateBucketVerdict(403, { message: 'Forbidden' }), 'ok (private)');
  assert.equal(privateBucketVerdict(200, 'secret'), 'readable by anon');
});

test('a healthy project passes, and every RPC is called with valid placeholder arguments', async () => {
  const { fetchFn, calls } = fakeProject();
  assert.deepEqual(failures(await verify(readEnv(ENV), fetchFn)), []);
  const review = calls.find((c) => c.url.endsWith('/rpc/review_business'));
  assert.deepEqual(JSON.parse(review.init.body), {
    p_business_id: PLACEHOLDERS.uuid, p_decision: 'verify-backend', p_note: 'verify-backend', p_seen_updated_at: PLACEHOLDERS.timestamptz,
  });
  assert.deepEqual(rpcBody(EXPECTED.rpcs.set_orders_paused), { p_business_id: PLACEHOLDERS.uuid, p_minutes: 1 });
});

test('reports each problem and never prints the key', async () => {
  const { fetchFn } = fakeProject({
    '/rest/v1/device_tokens': () => Response.json({ code: 'PGRST205' }, { status: 404 }),
    '/rpc/sync_verified_phone': () => Response.json({ code: 'PGRST202' }, { status: 404 }),
    '/rpc/export_my_data': () => Response.json([{}], { status: 200 }),
    '/functions/v1/geocode': () => new Response(null, { status: 404 }),
    '/functions/v1/recommend': () => new Response(null, { status: 404 }),
    '/functions/v1/push-dispatch': () => new Response('BOOT_ERROR', { status: 503 }),
    '/object/public/avatars/': () => new Response('a file', { status: 200 }),
    '/object/public/business-images/b1': () => Response.json({ message: 'Bucket not found' }, { status: 400 }),
  });
  const lines = await verify(readEnv(ENV, ['--expect-deployed=delete-account,geocode']), fetchFn);
  assert.deepEqual(failures(lines), [
    'FAIL table device_tokens (token): missing table',
    'FAIL rpc export_my_data: callable by anon',
    'FAIL rpc sync_verified_phone [migration 50]: missing',
    'FAIL function geocode: not deployed (expected)',
    'FAIL function push-dispatch: deployed but failing (503)',
    'FAIL bucket business-images (public): not serving b1/... (400)',
    'FAIL bucket avatars (private): readable by anon',
  ]);
  assert.ok(lines.some((l) => l.ok && l.line === 'ok   function recommend: not deployed (not expected yet)'));
  assert.equal(lines.some((l) => l.line.includes('anon-key-123')), false);
});

test('the public bucket without photos yet is checked with a probe', async () => {
  const { fetchFn } = fakeProject({
    '/rest/v1/business_photos?select=storage_path': () => Response.json([]),
    '/object/public/business-images/': () => Response.json({ error: 'not_found', message: 'Object not found' }, { status: 400 }),
  });
  const lines = await verify(readEnv(ENV), fetchFn);
  assert.ok(lines.some((l) => l.ok && l.line === 'ok   bucket business-images (public): ok (public, no photo yet to read)'));
});

/** Required parameters (no default) of the latest CREATE of each public function in the migrations. */
function requiredParams(sql, name) {
  const re = new RegExp(`create (?:or replace )?function public[.]${name}[(]`, 'gi');
  let start = -1;
  for (let m = re.exec(sql); m; m = re.exec(sql)) start = m.index + m[0].length;
  if (start < 0) return null;
  let depth = 1;
  let end = start;
  while (depth) depth += { '(': 1, ')': -1 }[sql[end++]] ?? 0;
  const params = sql.slice(start, end - 1).split(',').map((p) => p.trim()).filter(Boolean);
  return Object.fromEntries(params.filter((p) => !/\bdefault\b/i.test(p)).map((p) => p.split(/\s+/)).map(([n, t]) => [n, t]));
}

test('the expectations match the repository: every RPC with its required parameters, every function', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const sql = readdirSync(dir).sort().map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n');
  for (const [rpc, params] of Object.entries(EXPECTED.rpcs)) {
    assert.deepEqual(requiredParams(sql, rpc), params, rpc);
    assert.ok(Object.values(params).every((type) => type in PLACEHOLDERS), rpc);
  }
  const functions = readdirSync(new URL('../supabase/functions', import.meta.url), { withFileTypes: true })
    .filter((f) => f.isDirectory() && !f.name.startsWith('_')).map((f) => f.name);
  assert.deepEqual([...EXPECTED.functions].sort(), functions.sort());
});
