import { createClient } from '@supabase/supabase-js';

import { allowedOriginsFrom } from './cors.ts';
import { createHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !serviceRoleKey) {
  throw new Error('delete-account: missing Supabase environment configuration');
}

const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(
  createHandler({
    client,
    allowedOrigins: allowedOriginsFrom(Deno.env.get('ALLOWED_ORIGIN')),
  }),
);
