import { createClient } from '@supabase/supabase-js';

import { MerchantCredentialsFactory } from '../_shared/payments/merchant-credentials.ts';
import { PaymentEventVerifier } from '../_shared/payments/payment-event-verifier.ts';
import { PaymentLog } from '../_shared/payments/payment-log.ts';
import { SupabasePaymentRepository } from '../_shared/payments/payment-repository.ts';
import { WompiApi } from '../_shared/payments/wompi-api.ts';
import { createHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !serviceRoleKey) {
  throw new Error('wompi-webhook: missing Supabase environment configuration');
}
// Service role: Wompi calls this function, no user is involved. Only RPCs are used.
const service = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const credentials = new MerchantCredentialsFactory((name) => Deno.env.get(name)).forPlatform();

Deno.serve(
  createHandler({
    verifier: credentials
      ? new PaymentEventVerifier({
        environment: credentials.environment,
        eventsSecret: credentials.eventsSecret,
        repository: new SupabasePaymentRepository(service),
        api: new WompiApi(credentials),
      })
      : null,
    log: new PaymentLog(),
  }),
);
