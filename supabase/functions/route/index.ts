import { SupabaseEnv } from '../_shared/supabase-env.ts';
import { type CallerApi, createHandler } from './handler.ts';
import { routerFromEnv } from './providers.ts';

const env = SupabaseEnv.read('route', { service: true });

async function authenticate(token: string): Promise<CallerApi | null> {
  const caller = await env.asCaller(token);
  return caller && { consumeQuota: () => SupabaseEnv.allowed(caller.db, 'hit_rate_limit', { p_bucket: 'route' }) };
}

Deno.serve(
  createHandler({
    allowedOrigins: SupabaseEnv.allowedOrigins(),
    authenticate,
    router: routerFromEnv((name) => Deno.env.get(name)),
    cache: SupabaseEnv.cache(env.service()),
  }),
);
