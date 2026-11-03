import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { EXPECTED, VerifyError, readEnv, rpcVerdict, tableVerdict, verify } from './verify-backend.mjs';

test('needs https and refuses secret keys', () => {
  assert.throws(() => readEnv({}), VerifyError);
  assert.throws(() => readEnv({ SUPABASE_URL: 'http://x', SUPABASE_ANON_KEY: 'k' }), /https/);
  assert.throws(() => readEnv({ SUPABASE_URL: 'https://x', SUPABASE_ANON_KEY: 'sb_secret_abc' }), /never a secret/);
});

test('tells missing objects from private ones', () => {
  assert.equal(tableVerdict(200, []), 'ok');
  assert.equal(tableVerdict(401, { code: '42501' }), 'ok (private)');
  assert.equal(tableVerdict(404, { code: 'PGRST205' }), 'missing table');
  assert.equal(tableVerdict(400, { code: '42703' }), 'missing column');
  assert.equal(rpcVerdict(404, { code: 'PGRST202' }), 'missing');
  assert.equal(rpcVerdict(401, { code: '42501' }), 'ok');
  assert.equal(rpcVerdict(400, { code: 'P0001', message: 'not_authenticated' }), 'ok');
});

test('reports each object and never prints the key', async () => {
  const fetchFn = (url) => {
    if (url.includes('/rest/v1/device_tokens')) return Promise.resolve(Response.json({ code: 'PGRST205' }, { status: 404 }));
    if (url.includes('/rpc/export_my_data')) return Promise.resolve(Response.json({ code: 'PGRST202' }, { status: 404 }));
    if (url.includes('/functions/v1/geocode')) return Promise.resolve(new Response(null, { status: 404 }));
    if (url.includes('/storage/')) return Promise.resolve(Response.json({ error: 'not_found', message: 'Object not found' }, { status: 400 }));
    return Promise.resolve(Response.json([], { status: 200 }));
  };
  const lines = await verify(readEnv({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon-key-123' }), fetchFn);
  const failed = lines.filter((l) => !l.ok).map((l) => l.line);
  assert.deepEqual(failed, [
    'FAIL table device_tokens (token): missing table',
    'FAIL rpc export_my_data: missing',
    'FAIL function geocode: not deployed',
  ]);
  assert.equal(lines.some((l) => l.line.includes('anon-key-123')), false);
});

test('the expectations match the repository (every RPC and function exists here)', () => {
  const sql = readdirSync(new URL('../supabase/migrations', import.meta.url))
    .map((f) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8'))
    .join('\n');
  for (const rpc of EXPECTED.rpcs) assert.ok(sql.includes(`function public.${rpc}(`), rpc);
  const functions = readdirSync(new URL('../supabase/functions', import.meta.url)).filter((f) => !f.startsWith('_'));
  assert.deepEqual([...EXPECTED.functions].sort(), functions.sort());
});
