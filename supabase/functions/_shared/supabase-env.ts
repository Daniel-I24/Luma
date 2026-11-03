import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { allowedOriginsFrom } from './cors.ts';

const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false } };

/**
 * SupabaseEnv — the project of an Edge Function, read once from its
 * environment by its index.ts: the caller's client (their JWT, so RLS and
 * the RPCs decide), the service-role client (server-only work, never to
 * decide who the caller is), the CORS allow list and the answer cache.
 */
export class SupabaseEnv {
  private constructor(
    private readonly url: string,
    private readonly anonKey: string,
    private readonly serviceRoleKey: string | undefined,
  ) {}

  /** Throws "<name>: missing Supabase environment configuration" when a needed variable is missing. */
  public static read(name: string, needs: { readonly service?: boolean } = {}): SupabaseEnv {
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || (needs.service && !serviceRoleKey)) {
      throw new Error(`${name}: missing Supabase environment configuration`);
    }
    return new SupabaseEnv(url, anonKey, serviceRoleKey);
  }

  /** ALLOWED_ORIGINS (or the older ALLOWED_ORIGIN). */
  public static allowedOrigins(): readonly string[] {
    return allowedOriginsFrom(Deno.env.get('ALLOWED_ORIGINS'), Deno.env.get('ALLOWED_ORIGIN'));
  }

  /** A client acting as the caller and their user id, or null when the token is not a signed-in user. */
  public async asCaller(token: string): Promise<{ readonly db: SupabaseClient; readonly userId: string } | null> {
    const db = createClient(this.url, this.anonKey, { ...NO_SESSION, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data, error } = await db.auth.getUser(token);
    return error || !data.user ? null : { db, userId: data.user.id };
  }

  /** The service-role client (needs `read(name, { service: true })`). */
  public service(): SupabaseClient {
    if (!this.serviceRoleKey) throw new Error('service role not configured');
    return createClient(this.url, this.serviceRoleKey, NO_SESSION);
  }

  /** The server-side answer cache (ai_cache_get / ai_cache_put) through the service role. */
  public static cache(service: SupabaseClient) {
    return {
      get: async (key: string): Promise<unknown> => (await service.rpc('ai_cache_get', { p_key: key })).data,
      put: async (key: string, value: unknown, ttl: number): Promise<void> => {
        await service.rpc('ai_cache_put', { p_key: key, p_value: value, p_ttl_seconds: ttl });
      },
    };
  }

  /** A boolean RPC of the caller: true only when it answered true without error. */
  public static async allowed(db: SupabaseClient, fn: string, args?: Record<string, unknown>): Promise<boolean> {
    const { data, error } = await db.rpc(fn, args);
    return !error && data === true;
  }
}
