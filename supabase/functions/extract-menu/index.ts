import { createClient } from '@supabase/supabase-js';

import { allowedOriginsFrom } from '../_shared/cors.ts';
import { providerFromEnv } from '../_shared/llm/config.ts';
import { createHandler, type OwnerApi } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
if (!url || !anonKey) {
  throw new Error('extract-menu: missing Supabase environment configuration');
}
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

// Only the caller's JWT: ownership and quota are decided by RLS and the RPCs.
async function authenticate(token: string): Promise<OwnerApi | null> {
  const db = createClient(url!, anonKey!, {
    ...noSession,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return {
    ownsBusiness: async (businessId) => {
      const { data: owns, error: rpcError } = await db.rpc('owns_business', { p_business_id: businessId });
      return !rpcError && owns === true;
    },
    withinRateLimit: async () => {
      const { data: allowed, error: rpcError } = await db.rpc('hit_rate_limit', { p_bucket: 'menu_scan' });
      return !rpcError && allowed === true;
    },
    consumeQuota: async (businessId) => {
      const { data: allowed, error: rpcError } = await db.rpc('consume_menu_scan_quota', {
        p_business_id: businessId,
      });
      return !rpcError && allowed === true;
    },
  };
}

Deno.serve(
  createHandler({
    allowedOrigins: allowedOriginsFrom(Deno.env.get('ALLOWED_ORIGINS'), Deno.env.get('ALLOWED_ORIGIN')),
    authenticate,
    llm: providerFromEnv((name) => Deno.env.get(name), undefined, 'vision'),
  }),
);
