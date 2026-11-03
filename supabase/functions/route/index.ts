import { createClient } from '@supabase/supabase-js';

import { allowedOriginsFrom } from '../_shared/cors.ts';
import { type CallerApi, createHandler } from './handler.ts';
import { routerFromEnv } from './providers.ts';

const url = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !anonKey || !serviceRoleKey) {
  throw new Error('route: missing Supabase environment configuration');
}
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
// Service role: only for the server-side cache, never to decide who the caller is.
const service = createClient(url, serviceRoleKey, noSession);

async function authenticate(token: string): Promise<CallerApi | null> {
  const db = createClient(url!, anonKey!, {
    ...noSession,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return {
    consumeQuota: async () => {
      const { data: allowed, error: quotaError } = await db.rpc('hit_rate_limit', { p_bucket: 'route' });
      return !quotaError && allowed === true;
    },
  };
}

Deno.serve(
  createHandler({
    allowedOrigins: allowedOriginsFrom(Deno.env.get('ALLOWED_ORIGINS'), Deno.env.get('ALLOWED_ORIGIN')),
    authenticate,
    router: routerFromEnv((name) => Deno.env.get(name)),
    cache: {
      get: async (key) => (await service.rpc('ai_cache_get', { p_key: key })).data,
      put: async (key, value, ttl) => {
        await service.rpc('ai_cache_put', { p_key: key, p_value: value, p_ttl_seconds: ttl });
      },
    },
  }),
);
