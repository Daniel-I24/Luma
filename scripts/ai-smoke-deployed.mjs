#!/usr/bin/env node
/**
 * Smoke test of the deployed Luma IA functions, run by the owner after
 * deploying (never in CI: it spends real quota).
 *
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<anon key> \
 *   SMOKE_EMAIL=<test account> SMOKE_PASSWORD=<its password> \
 *   [SMOKE_BUSINESS_ID=<a business of that account>] [SMOKE_ORIGIN=https://<app>] \
 *   node scripts/ai-smoke-deployed.mjs [--menu]
 *
 * Signs in with a confirmed TEST account, calls recommend, then (with a
 * business id) suggest-promotions and, with --menu, extract-menu with a
 * 1x1 image. Prints only status codes and answer shapes: never keys,
 * tokens, prompts or answer texts. Exit 1 when a call fails; 503
 * ai_unavailable counts as a failure (the secrets are missing or wrong).
 */
import { fileURLToPath } from 'node:url';

export class SmokeError extends Error {}

/** A 1x1 transparent PNG: enough to check the request path of extract-menu. */
export const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const PASTO = { lat: 1.2136, lng: -77.2811 };

export function readSmokeEnv(env, argv = []) {
  const need = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SMOKE_EMAIL', 'SMOKE_PASSWORD'];
  const missing = need.filter((name) => !env[name]?.trim());
  if (missing.length) throw new SmokeError(`Missing: ${missing.join(', ')}.`);
  const url = env.SUPABASE_URL.trim().replace(/\/$/, '');
  if (!url.startsWith('https://')) throw new SmokeError('SUPABASE_URL must use https.');
  return {
    url,
    anonKey: env.SUPABASE_ANON_KEY.trim(),
    email: env.SMOKE_EMAIL.trim(),
    password: env.SMOKE_PASSWORD,
    businessId: env.SMOKE_BUSINESS_ID?.trim() || null,
    origin: env.SMOKE_ORIGIN?.trim() || 'https://localhost',
    menu: argv.includes('--menu'),
  };
}

/** The calls to make, in order. */
export function plan(config) {
  const calls = [{ name: 'recommend', body: { moment: 'lunch', ...PASTO, radius_km: 5 } }];
  if (config.businessId) {
    calls.push({ name: 'suggest-promotions', body: { business_id: config.businessId } });
    if (config.menu) calls.push({ name: 'extract-menu', body: { business_id: config.businessId, images: [TINY_PNG] } });
  }
  return calls;
}

/** One line per call, with shapes only. A 1x1 image may honestly give an empty menu. */
export function summarize(name, status, body) {
  const ok = status === 200;
  let shape = '';
  if (ok && name === 'recommend') shape = `businesses=${body?.businesses?.length ?? '?'} combo=${body?.combo ? 'yes' : 'no'}`;
  if (ok && name === 'suggest-promotions') shape = `source=${body?.source ?? '?'} ideas=${body?.ideas?.length ?? '?'}`;
  if (ok && name === 'extract-menu') shape = `items=${body?.items?.length ?? '?'}`;
  if (!ok) shape = `error=${typeof body?.error === 'string' ? body.error : 'unknown'}`;
  return { ok, line: `${ok ? 'ok  ' : 'FAIL'} ${name}: ${status} ${shape}`.trimEnd() };
}

export async function signIn(config, fetchFn) {
  const res = await fetchFn(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: config.email, password: config.password }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || typeof body?.access_token !== 'string') {
    throw new SmokeError(`Sign-in failed (${res.status}). Is the test account confirmed?`);
  }
  return body.access_token;
}

export async function runSmoke(config, fetchFn = fetch, log = (line) => process.stdout.write(`${line}\n`)) {
  const token = await signIn(config, fetchFn);
  let failures = 0;
  for (const call of plan(config)) {
    const res = await fetchFn(`${config.url}/functions/v1/${call.name}`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        authorization: `Bearer ${token}`,
        origin: config.origin,
        'content-type': 'application/json',
      },
      body: JSON.stringify(call.body),
    });
    const { ok, line } = summarize(call.name, res.status, await res.json().catch(() => null));
    if (!ok) failures++;
    log(line);
  }
  return failures;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const failures = await runSmoke(readSmokeEnv(process.env, process.argv.slice(2)));
    process.exitCode = failures ? 1 : 0;
  } catch (error) {
    process.stderr.write(`ai-smoke: ${error instanceof SmokeError ? error.message : 'unexpected error'}\n`);
    process.exitCode = 1;
  }
}
