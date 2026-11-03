import { MerchantCredentialsFactory } from '../_shared/payments/merchant-credentials.ts';
import { PaymentApplier } from '../_shared/payments/payment-applier.ts';
import { PaymentLog } from '../_shared/payments/payment-log.ts';
import { SupabasePaymentRepository } from '../_shared/payments/payment-repository.ts';
import { WompiApi } from '../_shared/payments/wompi-api.ts';
import { SupabaseEnv } from '../_shared/supabase-env.ts';
import { type AdminPayments, createHandler, type VoidTarget } from './handler.ts';

const env = SupabaseEnv.read('void-payment', { service: true });
const service = env.service();
const credentials = new MerchantCredentialsFactory((name) => Deno.env.get(name)).forPlatform();
const ERROR_CODE = /^[a-z_]{1,40}$/;

// The admin's own JWT: admin_request_void checks aal2 and writes the audit log.
async function authenticate(token: string): Promise<AdminPayments | null> {
  const caller = await env.asCaller(token);
  if (!caller) return null;
  const { db } = caller;
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
    allowedOrigins: SupabaseEnv.allowedOrigins(),
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
