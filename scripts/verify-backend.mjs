#!/usr/bin/env node
/**
 * Read-only check of a deployed Supabase project against what this
 * repository expects, using ONLY the public anon key (never a secret):
 *
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<anon key> \
 *   [APP_ORIGIN=https://<vercel domain>] node scripts/verify-backend.mjs
 *
 * - tables/columns: PostgREST answers "missing" (PGRST205, 42703) apart from
 *   "exists but not for anon" (401, 42501), so private tables are checked too;
 * - RPCs: "function not found" (PGRST202) vs anything else (it exists);
 * - Edge Functions: a CORS preflight; 404 means not deployed;
 * - buckets: a public read of a missing object ("Bucket not found" or not).
 * Nothing is written. Prints one line per check, never the key. Exit 1 when
 * something is missing.
 */
import { fileURLToPath } from 'node:url';

export class VerifyError extends Error {}

/** What the migrations up to the database freeze create. */
export const EXPECTED = {
  columns: {
    profiles: ['account_type', 'terms_accepted_at', 'privacy_accepted_at', 'notify_orders', 'notify_promotions',
      'residence_dane_code', 'show_avatar_to_business'],
    businesses: ['verification_status', 'prep_minutes', 'whatsapp', 'instagram', 'website', 'orders_paused_until',
      'city_dane_code'],
    menu_items: ['section'],
    promotions: ['discount_percent', 'notified_at'],
    orders: ['status', 'pickup_at', 'payment_status', 'cancel_reason'],
    notifications: ['type', 'promotion_id', 'pushed_at'],
    business_photos: ['storage_path', 'caption'],
    device_tokens: ['token'],
    reports: ['reason'],
    ai_usage: ['scope'],
  },
  rpcs: [
    'is_email_confirmed', 'create_order', 'cancel_order', 'set_order_status', 'become_business_owner',
    'submit_business_for_review', 'review_business', 'consume_ai_quota', 'consume_menu_scan_quota',
    'consume_geocode_quota', 'register_device_token', 'unregister_device_token', 'notify_promotion',
    'export_my_data', 'expire_stale_orders', 'claim_push_batch', 'admin_access', 'is_profile_complete', 'set_avatar',
    'my_trust_status', 'payment_config', 'prepare_payment', 'my_order_payment', 'record_payment_redirect',
    'set_orders_paused', 'owner_sales_daily', 'business_review_flags', 'admin_payment_issues', 'hit_rate_limit',
    'is_phone_verified', 'phone_check_passed', 'sync_verified_phone',
  ],
  functions: ['delete-account', 'recommend', 'suggest-promotions', 'extract-menu', 'geocode', 'push-dispatch',
    'create-payment', 'wompi-webhook', 'reconcile-payments', 'void-payment'],
  buckets: ['business-images', 'verification-docs', 'avatars'],
};

export function readEnv(env) {
  const url = env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new VerifyError('SUPABASE_URL and SUPABASE_ANON_KEY are required.');
  if (!url.startsWith('https://')) throw new VerifyError('SUPABASE_URL must use https.');
  if (key.startsWith('sb_secret_')) throw new VerifyError('Use the anon/publishable key, never a secret key.');
  return { url, key, origin: env.APP_ORIGIN?.trim() || 'https://localhost' };
}

const json = async (res) => res.json().catch(() => null);

/** Missing only when PostgREST says so; denied means it exists. */
export function tableVerdict(status, body) {
  if (status === 200 || status === 206) return 'ok';
  const code = body?.code;
  if (code === 'PGRST205' || code === '42P01') return 'missing table';
  if (code === '42703' || code === 'PGRST204') return 'missing column';
  if (status === 401 || status === 403 || code === '42501') return 'ok (private)';
  return `unknown (${status})`;
}

export function rpcVerdict(status, body) {
  if (body?.code === 'PGRST202' || (status === 404 && body?.code !== '42501')) return 'missing';
  return 'ok';
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
  for (const name of EXPECTED.rpcs) {
    const res = await fetchFn(`${config.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: '{}',
    });
    const verdict = rpcVerdict(res.status, await json(res));
    check(verdict === 'ok', `rpc ${name}: ${verdict}`);
  }
  for (const name of EXPECTED.functions) {
    const res = await fetchFn(`${config.url}/functions/v1/${name}`, {
      method: 'OPTIONS',
      headers: { origin: config.origin, 'access-control-request-method': 'POST' },
    });
    await res.body?.cancel?.();
    check(res.status !== 404, `function ${name}: ${res.status === 404 ? 'not deployed' : `deployed (${res.status})`}`);
  }
  for (const bucket of EXPECTED.buckets) {
    const res = await fetchFn(`${config.url}/storage/v1/object/public/${bucket}/verify-backend-probe.txt`, { headers });
    const body = await json(res);
    const missing = /bucket not found/i.test(JSON.stringify(body ?? ''));
    check(!missing, `bucket ${bucket}: ${missing ? 'missing' : 'ok'}`);
  }
  return lines;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const lines = await verify(readEnv(process.env));
    for (const { line } of lines) process.stdout.write(`${line}\n`);
    const failed = lines.filter((l) => !l.ok).length;
    process.stdout.write(failed ? `verify-backend: ${failed} problem(s)\n` : 'verify-backend: ok\n');
    process.exitCode = failed ? 1 : 0;
  } catch (error) {
    process.stderr.write(`verify-backend: ${error instanceof VerifyError ? error.message : 'unexpected error'}\n`);
    process.exitCode = 1;
  }
}
