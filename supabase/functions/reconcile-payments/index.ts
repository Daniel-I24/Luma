import { createClient } from '@supabase/supabase-js';

import { MerchantCredentialsFactory } from '../_shared/payments/merchant-credentials.ts';
import { PaymentApplier } from '../_shared/payments/payment-applier.ts';
import { PaymentLog } from '../_shared/payments/payment-log.ts';
import { SupabasePaymentRepository } from '../_shared/payments/payment-repository.ts';
import { Reconciler } from '../_shared/payments/reconciler.ts';
import { WompiApi } from '../_shared/payments/wompi-api.ts';
import { createHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !anonKey || !serviceRoleKey) {
  throw new Error('reconcile-payments: missing Supabase environment configuration');
}
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, serviceRoleKey, noSession);
const credentials = new MerchantCredentialsFactory((name) => Deno.env.get(name)).forPlatform();
const repository = new SupabasePaymentRepository(service);

Deno.serve(
  createHandler({
    cronSecret: Deno.env.get('PAYMENTS_CRON_SECRET') ?? null,
    // The admin's own JWT: is_admin() (aal2) decides, and the request is logged.
    isAdmin: async (token) => {
      const db = createClient(url, anonKey, { ...noSession, global: { headers: { Authorization: `Bearer ${token}` } } });
      const { error } = await db.rpc('admin_note_reconcile');
      return !error;
    },
    run: credentials
      ? () => new Reconciler(repository, new WompiApi(credentials), new PaymentApplier(repository, credentials.environment),
        credentials.environment).run()
      : null,
    log: new PaymentLog(),
  }),
);
