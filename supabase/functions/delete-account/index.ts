import { createClient } from '@supabase/supabase-js';

import { allowedOriginsFrom } from '../_shared/cors.ts';
import { createHandler } from './handler.ts';
import type { CleanupClient } from './storage-cleanup.ts';

const url = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !serviceRoleKey) {
  throw new Error('delete-account: missing Supabase environment configuration');
}

const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Narrow adapter: only the calls the cleanup makes (keeps type checking shallow).
const cleanup: CleanupClient = {
  from: () => ({
    select: () => ({
      eq: (column, value) => client.from('businesses').select('id').eq(column, value),
    }),
  }),
  storage: { from: (bucket) => client.storage.from(bucket) },
};

Deno.serve(
  createHandler({
    client: { auth: client.auth, ...cleanup },
    allowedOrigins: allowedOriginsFrom(Deno.env.get('ALLOWED_ORIGINS'), Deno.env.get('ALLOWED_ORIGIN')),
  }),
);
