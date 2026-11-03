import { createClient } from '@supabase/supabase-js';

import { APP_PAYMENT_RETURN_URL } from '../_shared/config/app-links.ts';
import { allowedOriginsFrom } from '../_shared/cors.ts';
import { MerchantCredentialsFactory } from '../_shared/payments/merchant-credentials.ts';
import { PaymentLog } from '../_shared/payments/payment-log.ts';
import { createHandler, type CustomerPayments, type Prepared } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
if (!url || !anonKey) {
  throw new Error('create-payment: missing Supabase environment configuration');
}
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** prepare_payment raises its rule as the message ("too_many_attempts", ...). */
const errorCode = (error: unknown): string => {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && /^[a-z_]{1,40}$/.test(message) ? message : 'payments_unavailable';
};

// Only the caller's JWT: the order, the attempts and the amount are decided by RLS and prepare_payment.
async function authenticate(token: string): Promise<CustomerPayments | null> {
  const db = createClient(url!, anonKey!, { ...noSession, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return {
    emailConfirmed: async () => (await db.rpc('is_email_confirmed')).data === true,
    withinRateLimit: async () => (await db.rpc('hit_rate_limit', { p_bucket: 'create_payment' })).data === true,
    order: async (orderId) => {
      const { data: row, error: readError } = await db.from('orders')
        .select('status, payment_method').eq('id', orderId).maybeSingle();
      if (readError) throw new Error('order_read_failed');
      return row ? { status: String(row.status), paymentMethod: String(row.payment_method) } : null;
    },
    prepare: async (orderId, environment): Promise<Prepared> => {
      const { data: rows, error: rpcError } = await db.rpc('prepare_payment', { p_order_id: orderId, p_environment: environment });
      if (rpcError) return { error: errorCode(rpcError) };
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) return { error: 'payments_unavailable' };
      return { reference: row.reference, amountInCents: Number(row.amount_in_cents), expiresAt: row.expires_at, attempt: row.attempt };
    },
  };
}

Deno.serve(
  createHandler({
    allowedOrigins: allowedOriginsFrom(Deno.env.get('ALLOWED_ORIGINS'), Deno.env.get('ALLOWED_ORIGIN')),
    credentials: new MerchantCredentialsFactory((name) => Deno.env.get(name)).forPlatform(),
    redirectUrl: APP_PAYMENT_RETURN_URL,
    authenticate,
    log: new PaymentLog(),
  }),
);
