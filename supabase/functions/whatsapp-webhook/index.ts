import { createClient } from '@supabase/supabase-js';

import { createHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !serviceRoleKey) throw new Error('whatsapp-webhook: missing Supabase environment configuration');
const service = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

/** EdgeRuntime.waitUntil when Supabase provides it: the 200 goes out before the database calls. */
const runtime = (globalThis as { EdgeRuntime?: { waitUntil(work: Promise<unknown>): void } }).EdgeRuntime;

Deno.serve(
  createHandler({
    verifyToken: Deno.env.get('WHATSAPP_VERIFY_TOKEN')?.trim() || null,
    appSecret: Deno.env.get('WHATSAPP_APP_SECRET')?.trim() || null,
    background: runtime ? (work) => runtime.waitUntil(work) : undefined,
    verify: async ({ messageId, senderHash, sender, code }) => {
      const { data, error } = await service.rpc('verify_contact_from_whatsapp', {
        p_message_id: messageId,
        p_sender_hash: senderHash,
        p_sender: sender,
        p_code: code,
      });
      if (error) throw new Error('rpc failed');
      return String(data);
    },
  }),
);
