import { createClient } from '@supabase/supabase-js';

import { allowedOriginsFrom } from '../_shared/cors.ts';
import { providerFromEnv } from '../_shared/llm/config.ts';
import { createHandler, type OwnerApi } from './handler.ts';
import type { SalesSummary } from './model.ts';

const url = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !anonKey || !serviceRoleKey) {
  throw new Error('suggest-promotions: missing Supabase environment configuration');
}
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
// Service role: only for the server-side cache. Ownership is always checked
// with the caller's own client (RLS and owner-only RPCs).
const service = createClient(url, serviceRoleKey, noSession);

async function authenticate(token: string): Promise<OwnerApi | null> {
  const db = createClient(url!, anonKey!, {
    ...noSession,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await db.auth.getUser(token);
  const user = data.user;
  if (error || !user) return null;
  return {
    ownsApprovedBusiness: async (id) => {
      const { data: row } = await db
        .from('businesses')
        .select('id')
        .eq('id', id)
        .eq('owner_id', user.id)
        .eq('verification_status', 'approved')
        .maybeSingle();
      return row !== null;
    },
    consumeQuota: async (id) => {
      const { data: allowed, error: quotaError } = await db.rpc('consume_ai_quota', { p_business_id: id });
      return !quotaError && allowed === true;
    },
    salesSummary: async (id) => {
      const { data: summary, error: rpcError } = await db.rpc('owner_sales_summary', { p_business_id: id });
      return rpcError || !summary ? null : (summary as SalesSummary);
    },
    promotedItems: async (id) => {
      const { data: rows, error: readError } = await db
        .from('promotions')
        .select('menu_item_id')
        .eq('business_id', id)
        .eq('is_active', true)
        .gt('ends_at', new Date().toISOString());
      if (readError || !rows) return null;
      return new Set(rows.flatMap((r) => (r.menu_item_id ? [r.menu_item_id as string] : [])));
    },
  };
}

Deno.serve(
  createHandler({
    allowedOrigins: allowedOriginsFrom(Deno.env.get('ALLOWED_ORIGINS'), Deno.env.get('ALLOWED_ORIGIN')),
    authenticate,
    llm: providerFromEnv((name) => Deno.env.get(name)),
    cache: {
      get: async (key) => (await service.rpc('ai_cache_get', { p_key: key })).data,
      put: async (key, value, ttl) => {
        await service.rpc('ai_cache_put', { p_key: key, p_value: value, p_ttl_seconds: ttl });
      },
    },
  }),
);
