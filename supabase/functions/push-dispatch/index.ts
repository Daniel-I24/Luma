import { createClient } from '@supabase/supabase-js';

import { FcmClient, serviceAccountFrom } from './fcm.ts';
import { createHandler } from './handler.ts';
import type { PushRow } from './messages.ts';

const url = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !serviceRoleKey) {
  throw new Error('push-dispatch: missing Supabase environment configuration');
}
// Service role: this function is called by the database only (shared secret).
const service = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const account = serviceAccountFrom(Deno.env.get('FCM_SERVICE_ACCOUNT'));

Deno.serve(
  createHandler({
    secret: Deno.env.get('PUSH_DISPATCH_SECRET') ?? null,
    sender: account ? new FcmClient(account) : null,
    store: {
      claim: async (limit) => {
        const { data, error } = await service.rpc('claim_push_batch', { p_limit: limit });
        if (error || !Array.isArray(data)) throw new Error('claim_failed');
        return data as PushRow[];
      },
      removeTokens: async (tokens) => {
        const { error } = await service.rpc('remove_device_tokens', { p_tokens: tokens });
        if (error) throw new Error('remove_failed');
      },
    },
  }),
);
