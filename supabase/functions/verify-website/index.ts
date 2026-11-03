import { createClient } from '@supabase/supabase-js';

import { allowedOriginsFrom } from '../_shared/cors.ts';
import { type CallerApi, createHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !anonKey || !serviceRoleKey) throw new Error('verify-website: missing Supabase environment configuration');
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
// Service role: only complete_website_check, after the file matched.
const service = createClient(url, serviceRoleKey, noSession);

async function authenticate(token: string): Promise<CallerApi | null> {
  const db = createClient(url!, anonKey!, { ...noSession, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return {
    startCheck: async (businessId) => {
      const { data: rows, error: rpcError } = await db.rpc('start_website_check', { p_business_id: businessId });
      if (rpcError) return { error: rpcError.message?.trim() || 'failed' };
      const row = (Array.isArray(rows) ? rows[0] : rows) as { verification_id: string; website: string; code: string } | undefined;
      return row ? { verificationId: row.verification_id, website: row.website, code: row.code } : { error: 'no_pending_request' };
    },
  };
}

/** A and AAAA records; an unknown host resolves to nothing (refused). */
async function resolve(host: string): Promise<string[]> {
  const lists = await Promise.all(
    (['A', 'AAAA'] as const).map((type) => Deno.resolveDns(host, type).catch(() => [] as string[])),
  );
  return lists.flat();
}

Deno.serve(
  createHandler({
    allowedOrigins: allowedOriginsFrom(Deno.env.get('ALLOWED_ORIGINS'), Deno.env.get('ALLOWED_ORIGIN')),
    authenticate,
    complete: async (verificationId) => {
      const { data, error } = await service.rpc('complete_website_check', { p_verification_id: verificationId });
      return !error && data === true;
    },
    resolve,
    fetchFn: (target, init) => fetch(target, init),
  }),
);
