import { MerchantCredentialsFactory } from '../_shared/payments/merchant-credentials.ts';
import { PaymentLog } from '../_shared/payments/payment-log.ts';
import { SupabaseEnv } from '../_shared/supabase-env.ts';
import { createHandler, type CustomerPayments, type Prepared } from './handler.ts';

const env = SupabaseEnv.read('create-payment');
/** Wompi sends the customer back here after the checkout (informative only; deep link of AndroidManifest.xml). */
const APP_PAYMENT_RETURN_URL = 'luma://payments/return';

const MAX_WAIT_SECONDS = 600;

/**
 * prepare_payment raises its rule as the message ("too_many_attempts", ...);
 * attempt_in_progress carries the seconds left in its hint.
 */
const refusal = (error: unknown): Prepared => {
  const { message, hint } = (error ?? {}) as { message?: unknown; hint?: unknown };
  const code = typeof message === 'string' && /^[a-z_]{1,40}$/.test(message) ? message : 'payments_unavailable';
  const wait = typeof hint === 'string' && /^\d{1,4}$/.test(hint) ? Math.min(Number(hint), MAX_WAIT_SECONDS) : null;
  return code === 'attempt_in_progress' && wait !== null ? { error: code, retryAfterSeconds: wait } : { error: code };
};

// Only the caller's JWT: the order, the attempts and the amount are decided by RLS and prepare_payment.
async function authenticate(token: string): Promise<CustomerPayments | null> {
  const caller = await env.asCaller(token);
  if (!caller) return null;
  const { db } = caller;
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
      if (rpcError) return refusal(rpcError);
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) return { error: 'payments_unavailable' };
      return { reference: row.reference, amountInCents: Number(row.amount_in_cents), expiresAt: row.expires_at, attempt: row.attempt };
    },
  };
}

Deno.serve(
  createHandler({
    allowedOrigins: SupabaseEnv.allowedOrigins(),
    credentials: new MerchantCredentialsFactory((name) => Deno.env.get(name)).forPlatform(),
    redirectUrl: APP_PAYMENT_RETURN_URL,
    authenticate,
    log: new PaymentLog(),
  }),
);
