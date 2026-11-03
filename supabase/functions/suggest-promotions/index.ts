import { providerFromEnv } from '../_shared/llm/config.ts';
import { SupabaseEnv } from '../_shared/supabase-env.ts';
import { createHandler, type OwnerApi } from './handler.ts';
import type { SalesSummary } from './model.ts';

// The service role is only for the server-side cache. Ownership is always
// checked with the caller's own client (RLS and owner-only RPCs).
const env = SupabaseEnv.read('suggest-promotions', { service: true });

async function authenticate(token: string): Promise<OwnerApi | null> {
  const caller = await env.asCaller(token);
  if (!caller) return null;
  const { db, userId } = caller;
  return {
    ownsApprovedBusiness: async (id) => {
      const { data: row } = await db
        .from('businesses')
        .select('id')
        .eq('id', id)
        .eq('owner_id', userId)
        .eq('verification_status', 'approved')
        .maybeSingle();
      return row !== null;
    },
    consumeQuota: (id) => SupabaseEnv.allowed(db, 'consume_ai_quota', { p_business_id: id }),
    salesSummary: async (id) => {
      const { data: summary, error } = await db.rpc('owner_sales_summary', { p_business_id: id });
      return error || !summary ? null : (summary as SalesSummary);
    },
    promotedItems: async (id) => {
      const { data: rows, error } = await db
        .from('promotions')
        .select('menu_item_id')
        .eq('business_id', id)
        .eq('is_active', true)
        .gt('ends_at', new Date().toISOString());
      if (error || !rows) return null;
      return new Set(rows.flatMap((r) => (r.menu_item_id ? [r.menu_item_id as string] : [])));
    },
  };
}

Deno.serve(
  createHandler({
    allowedOrigins: SupabaseEnv.allowedOrigins(),
    authenticate,
    llm: providerFromEnv((name) => Deno.env.get(name)),
    cache: SupabaseEnv.cache(env.service()),
  }),
);
