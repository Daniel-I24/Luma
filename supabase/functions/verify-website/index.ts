import { SupabaseEnv } from '../_shared/supabase-env.ts';
import { type CallerApi, createHandler } from './handler.ts';
import { runtimeResolver } from './resolver.ts';

const env = SupabaseEnv.read('verify-website', { service: true });
// Service role: only complete_website_check, after the file matched.
const service = env.service();

async function authenticate(token: string): Promise<CallerApi | null> {
  const caller = await env.asCaller(token);
  if (!caller) return null;
  const { db } = caller;
  return {
    startCheck: async (businessId) => {
      const { data: rows, error: rpcError } = await db.rpc('start_website_check', { p_business_id: businessId });
      if (rpcError) return { error: rpcError.message?.trim() || 'failed' };
      const row = (Array.isArray(rows) ? rows[0] : rows) as { verification_id: string; website: string; code: string } | undefined;
      return row ? { verificationId: row.verification_id, website: row.website, code: row.code } : { error: 'no_pending_request' };
    },
  };
}

// Deno.resolveDns when the runtime has it, DNS over HTTPS otherwise (resolver.ts).
const native = typeof Deno.resolveDns === 'function' ? (host: string, type: 'A' | 'AAAA') => Deno.resolveDns(host, type) : undefined;
const resolve = runtimeResolver(native, (target, init) => fetch(target, init));

Deno.serve(
  createHandler({
    allowedOrigins: SupabaseEnv.allowedOrigins(),
    authenticate,
    complete: async (verificationId) => {
      const { data, error } = await service.rpc('complete_website_check', { p_verification_id: verificationId });
      return !error && data === true;
    },
    resolve,
    fetchFn: (target, init) => fetch(target, init),
  }),
);
