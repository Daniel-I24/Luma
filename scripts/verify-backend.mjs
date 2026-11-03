#!/usr/bin/env node
/**
 * Read-only check of a deployed Supabase project against what this
 * repository expects, using ONLY the public anon key (never a secret):
 *
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<anon key> \
 *   [APP_ORIGIN=https://<vercel domain>] node scripts/verify-backend.mjs \
 *   [--expect-deployed=delete-account,geocode]
 *
 * - tables/columns: PostgREST answers "missing" (PGRST205, 42703) apart from
 *   "exists but not for anon" (401, 42501), so private tables are checked too;
 * - RPCs: called with placeholder values for their required parameters
 *   (verify-backend.expected.mjs): 401, 403 or 42501 is "protected", PGRST202
 *   with those arguments "missing" (expected, not a failure, for migration 52
 *   until it is applied). anon executes none (function_privileges.sql);
 * - Edge Functions: a CORS preflight. 404 is "not deployed" (a problem only
 *   for the names in --expect-deployed, empty by default); 5xx is "deployed
 *   but failing" (always a problem);
 * - buckets: private ones (verification-docs, avatars) are right when anon
 *   gets "not found" or "forbidden"; the public one serves an object
 *   (a photo listed in business_photos, or "Object not found" for a probe).
 * Nothing is written. One line per check, never the key. Exit 1 when wrong.
 */
import { fileURLToPath } from 'node:url';

import { EXPECTED, rpcBody } from './verify-backend.expected.mjs';

export class VerifyError extends Error {}

export function readEnv(env, argv = []) {
  const url = env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new VerifyError('SUPABASE_URL and SUPABASE_ANON_KEY are required.');
  if (!url.startsWith('https://')) throw new VerifyError('SUPABASE_URL must use https.');
  if (key.startsWith('sb_secret_')) throw new VerifyError('Use the anon/publishable key, never a secret key.');
  const flag = argv.find((a) => a.startsWith('--expect-deployed='));
  const expectDeployed = (flag?.slice('--expect-deployed='.length) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = expectDeployed.filter((name) => !EXPECTED.functions.includes(name));
  if (unknown.length) throw new VerifyError(`Unknown function(s) in --expect-deployed: ${unknown.join(', ')}`);
  return { url, key, origin: env.APP_ORIGIN?.trim() || 'https://localhost', expectDeployed };
}

const json = async (res) => res.json().catch(() => null);
const SERVER_ERROR = 500;

/** Missing only when PostgREST says so; denied means it exists. */
export function tableVerdict(status, body) {
  if (status === 200 || status === 206) return 'ok';
  const code = body?.code;
  if (code === 'PGRST205' || code === '42P01') return 'missing table';
  if (code === '42703' || code === 'PGRST204') return 'missing column';
  if (status === 401 || status === 403 || code === '42501') return 'ok (private)';
  return `unknown (${status})`;
}

/** Verdict of an RPC called WITH its required arguments. */
export function rpcVerdict(status, body) {
  const code = body?.code;
  if (status === 401 || status === 403 || code === '42501') return 'ok (protected)';
  if (code === 'PGRST202') return 'missing';
  if (status >= 200 && status < 300) return 'callable by anon';
  if (status >= SERVER_ERROR || status === 404) return `unknown (${status}${code ? ` ${code}` : ''})`;
  return `ok (exists, ${status}${code ? ` ${code}` : ''})`;
}

/** not deployed (404), failing (5xx) or deployed. */
export function functionVerdict(status) {
  if (status === 404) return 'not deployed';
  return status >= SERVER_ERROR ? 'deployed but failing' : 'deployed';
}

/** Private buckets must not answer anon; "not found" and "forbidden" both mean that. */
export function privateBucketVerdict(status, body) {
  if (status >= 200 && status < 300) return 'readable by anon';
  const text = JSON.stringify(body ?? '');
  if ([400, 401, 403, 404].includes(status) || /not found|unauthorized|forbidden|denied/i.test(text)) return 'ok (private)';
  return `unknown (${status})`;
}

async function checkPublicBucket(config, headers, fetchFn, bucket) {
  const base = `${config.url}/storage/v1/object/public/${bucket}`;
  const photos = await fetchFn(`${config.url}/rest/v1/business_photos?select=storage_path&limit=1`, { headers });
  const path = (await json(photos))?.[0]?.storage_path;
  if (photos.ok && typeof path === 'string') {
    const res = await fetchFn(`${base}/${path.split('/').map(encodeURIComponent).join('/')}`, { headers });
    await res.body?.cancel?.();
    return res.ok ? 'ok (serves objects)' : `not serving ${path.split('/')[0]}/... (${res.status})`;
  }
  const res = await fetchFn(`${base}/verify-backend-probe.txt`, { headers });
  const text = JSON.stringify((await json(res)) ?? '');
  if (/bucket not found/i.test(text)) return 'missing or not public';
  return /object not found|not_found/i.test(text) ? 'ok (public, no photo yet to read)' : `unknown (${res.status})`;
}

export async function verify(config, fetchFn = fetch) {
  const headers = { apikey: config.key, authorization: `Bearer ${config.key}` };
  const lines = [];
  const check = (ok, line) => lines.push({ ok, line: `${ok ? 'ok  ' : 'FAIL'} ${line}` });

  for (const [table, columns] of Object.entries(EXPECTED.columns)) {
    const res = await fetchFn(`${config.url}/rest/v1/${table}?select=${columns.join(',')}&limit=0`, { headers });
    const verdict = tableVerdict(res.status, await json(res));
    check(verdict.startsWith('ok'), `table ${table} (${columns.join(', ')}): ${verdict}`);
  }
  for (const [name, params] of Object.entries(EXPECTED.rpcs)) {
    const body = JSON.stringify(rpcBody(params));
    const res = await fetchFn(`${config.url}/rest/v1/rpc/${name}`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body });
    const verdict = rpcVerdict(res.status, await json(res));
    const pending = EXPECTED.migration52.includes(name);
    const tag = EXPECTED.migration50.includes(name) ? ' [migration 50]' : pending ? ' [migration 52]' : '';
    check(verdict.startsWith('ok') || (pending && verdict === 'missing'), `rpc ${name}${tag}: ${verdict}`);
  }
  for (const name of EXPECTED.functions) {
    const res = await fetchFn(`${config.url}/functions/v1/${name}`, {
      method: 'OPTIONS',
      headers: { origin: config.origin, 'access-control-request-method': 'POST' },
    });
    await res.body?.cancel?.();
    const verdict = functionVerdict(res.status);
    const expected = config.expectDeployed.includes(name);
    const ok = verdict === 'deployed' || (verdict === 'not deployed' && !expected);
    const note = verdict === 'not deployed' ? (expected ? ' (expected)' : ' (not expected yet)') : ` (${res.status})`;
    check(ok, `function ${name}: ${verdict}${note}`);
  }
  for (const [bucket, kind] of Object.entries(EXPECTED.buckets)) {
    if (kind === 'public') {
      const verdict = await checkPublicBucket(config, headers, fetchFn, bucket);
      check(verdict.startsWith('ok'), `bucket ${bucket} (public): ${verdict}`);
      continue;
    }
    const res = await fetchFn(`${config.url}/storage/v1/object/public/${bucket}/verify-backend-probe.txt`, { headers });
    const verdict = privateBucketVerdict(res.status, await json(res));
    check(verdict.startsWith('ok'), `bucket ${bucket} (private): ${verdict}`);
  }
  return lines;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const lines = await verify(readEnv(process.env, process.argv.slice(2)));
    for (const { line } of lines) process.stdout.write(`${line}\n`);
    const failed = lines.filter((l) => !l.ok).length;
    process.stdout.write(failed ? `verify-backend: ${failed} problem(s)\n` : 'verify-backend: ok\n');
    process.exitCode = failed ? 1 : 0;
  } catch (error) {
    process.stderr.write(`verify-backend: ${error instanceof VerifyError ? error.message : 'unexpected error'}\n`);
    process.exitCode = 1;
  }
}
