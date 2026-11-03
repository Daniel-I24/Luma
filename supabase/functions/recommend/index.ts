import { providerFromEnv } from '../_shared/llm/config.ts';
import { SupabaseEnv } from '../_shared/supabase-env.ts';
import { type CallerApi, createHandler } from './handler.ts';
import type { Candidate } from './model.ts';

const env = SupabaseEnv.read('recommend', { service: true });

async function authenticate(token: string): Promise<CallerApi | null> {
  const caller = await env.asCaller(token);
  if (!caller) return null;
  const { db } = caller;
  return {
    consumeQuota: () => SupabaseEnv.allowed(db, 'consume_ai_quota'),
    candidates: async (lat, lng, radiusKm, at) => {
      const { data: rows, error } = await db.rpc('ai_recommend_candidates', { p_lat: lat, p_lng: lng, p_radius_km: radiusKm, p_at: at });
      return error || !Array.isArray(rows) ? null : (rows as Candidate[]);
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
