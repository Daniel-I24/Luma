import { providerFromEnv } from '../_shared/llm/config.ts';
import { SupabaseEnv } from '../_shared/supabase-env.ts';
import { createHandler, type OwnerApi } from './handler.ts';

// Only the caller's JWT: ownership and quota are decided by RLS and the RPCs.
const env = SupabaseEnv.read('extract-menu');

async function authenticate(token: string): Promise<OwnerApi | null> {
  const caller = await env.asCaller(token);
  if (!caller) return null;
  const { db } = caller;
  return {
    ownsBusiness: (businessId) => SupabaseEnv.allowed(db, 'owns_business', { p_business_id: businessId }),
    withinRateLimit: () => SupabaseEnv.allowed(db, 'hit_rate_limit', { p_bucket: 'menu_scan' }),
    consumeQuota: (businessId) => SupabaseEnv.allowed(db, 'consume_menu_scan_quota', { p_business_id: businessId }),
  };
}

Deno.serve(
  createHandler({
    allowedOrigins: SupabaseEnv.allowedOrigins(),
    authenticate,
    llm: providerFromEnv((name) => Deno.env.get(name), undefined, 'vision'),
  }),
);
