import { createClient } from '@supabase/supabase-js';

import { allowedOriginsFrom } from '../_shared/cors.ts';
import { MerchantCredentialsFactory } from '../_shared/payments/merchant-credentials.ts';
import { PaymentApplier } from '../_shared/payments/payment-applier.ts';
import { PaymentLog } from '../_shared/payments/payment-log.ts';
import { SupabasePaymentRepository } from '../_shared/payments/payment-repository.ts';
import { WompiApi } from '../_shared/payments/wompi-api.ts';
import { type AdminPayments, createHandler, type VoidTarget } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !anonKey || !serviceRoleKey) {
  throw new Error('void-payment: missing Supabase environment configuration');
}
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, serviceRoleKey, noSession);
const credentials = new MerchantCredentialsFactory((name) => Deno.env.get(name)).forPlatform();
const ERROR_CODE = /^[a-z_]{1,40}$/;

// The admin's own JWT: admin_request_void checks aal2 and writes the audit log.
async function authenticate(token: string): Promise<AdminPayments | null> {
  const db = createClient(url!, anonKey!, { ...noSession, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return {
    requestVoid: async (paymentId): Promise<VoidTarget> => {
      const { data: rows, error: rpcError } = await db.rpc('admin_request_void', { p_payment_id: paymentId });
      if (rpcError) {
        const message = String((rpcError as { message?: unknown }).message ?? '');
        return { error: ERROR_CODE.test(message) ? message : 'payments_unavailable' };
      }
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) return { error: 'payment_not_voidable' };
      return { transactionId: row.transaction_id, environment: row.environment === 'prod' ? 'prod' : 'test', card: row.card === true };
    },
  };
}

const api = credentials ? new WompiApi(credentials) : null;
const applier = credentials ? new PaymentApplier(new SupabasePaymentRepository(service), credentials.environment) : null;

Deno.serve(
  createHandler({
    allowedOrigins: allowedOriginsFrom(Deno.env.get('ALLOWED_ORIGINS'), Deno.env.get('ALLOWED_ORIGIN')),
    authenticate,
    gateway: credentials && api && applier
      ? {
        environment: credentials.environment,
        void: (id) => api.void(id),
        transaction: (id) => api.transaction(id),
        record: (tx) => applier.apply(tx, 'void'),
      }
      : null,
    log: new PaymentLog(),
  }),
);
