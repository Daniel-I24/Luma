import { SupabaseEnv } from '../_shared/supabase-env.ts';
import { type CallerApi, createHandler } from './handler.ts';
import { geocoderFromEnv } from './providers.ts';

const env = SupabaseEnv.read('geocode', { service: true });

async function authenticate(token: string): Promise<CallerApi | null> {
  const caller = await env.asCaller(token);
  return caller && { consumeQuota: () => SupabaseEnv.allowed(caller.db, 'consume_geocode_quota') };
}

Deno.serve(
  createHandler({
    allowedOrigins: SupabaseEnv.allowedOrigins(),
    authenticate,
    geocoder: geocoderFromEnv((name) => Deno.env.get(name)),
    cache: SupabaseEnv.cache(env.service()),
  }),
);
