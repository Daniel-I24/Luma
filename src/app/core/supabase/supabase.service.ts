import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/**
 * SupabaseService — provides the singleton Supabase client.
 *
 * Only the public anon key is used here; the service_role key
 * must never leave the backend (Edge Functions).
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(
    environment.supabase.url,
    environment.supabase.anonKey,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    },
  );
}
