import { bearerToken, json, preflight, readJson } from '../_shared/edge.ts';
import type { WompiEnvironment } from '../_shared/payments/merchant-credentials.ts';
import type { PaymentLog } from '../_shared/payments/payment-log.ts';
import type { EventTransaction } from '../_shared/payments/wompi-event.ts';

/** admin_request_void's answer (it also checks aal2 and writes the audit log). */
export type VoidTarget =
  | { readonly transactionId: string; readonly environment: WompiEnvironment; readonly card: boolean }
  | { readonly error: string };

/** What the function may do as the admin (their JWT). */
export interface AdminPayments {
  requestVoid(paymentId: string): Promise<VoidTarget>;
}

/** The Wompi side (private key) and the database side (service role). */
interface VoidGateway {
  readonly environment: WompiEnvironment;
  void(transactionId: string): Promise<boolean>;
  transaction(transactionId: string): Promise<EventTransaction | null>;
  record(tx: EventTransaction): Promise<string>;
}

export interface VoidDeps {
  readonly allowedOrigins: readonly string[];
  authenticate(token: string): Promise<AdminPayments | null>;
  readonly gateway: VoidGateway | null;
  readonly log: PaymentLog;
}

const UUID = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 256;
const TARGET_ERRORS: Readonly<Record<string, number>> = { not_admin: 403, payment_not_voidable: 409 };

/**
 * Admin only (aal2). Voids a card payment through the Wompi API and records
 * the VOIDED state after confirming it; any other method answers "manual":
 * the admin refunds it in the Wompi dashboard and marks it done in Luma.
 */
export function createHandler(deps: VoidDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const checked = preflight(req, deps.allowedOrigins);
    if ('response' in checked) return checked.response;
    const { cors } = checked;
    try {
      const token = bearerToken(req);
      const body = (await readJson(req, MAX_BODY_BYTES)) as { payment_id?: unknown } | null;
      const paymentId = typeof body?.payment_id === 'string' && UUID.test(body.payment_id) ? body.payment_id : null;
      if (!token) return json(401, { error: 'unauthorized' }, cors);
      if (!paymentId) return json(400, { error: 'invalid_request' }, cors);
      const admin = await deps.authenticate(token);
      if (!admin) return json(401, { error: 'unauthorized' }, cors);
      if (!deps.gateway) return json(503, { error: 'payments_unavailable' }, cors);
      const target = await admin.requestVoid(paymentId);
      if ('error' in target) {
        const known = target.error in TARGET_ERRORS;
        return json(TARGET_ERRORS[target.error] ?? 503, { error: known ? target.error : 'payments_unavailable' }, cors);
      }
      if (target.environment !== deps.gateway.environment) return json(409, { error: 'payment_not_voidable' }, cors);
      if (!target.card || !(await deps.gateway.void(target.transactionId))) {
        deps.log.info('void_manual', { source: 'void' });
        return json(200, { result: 'manual' }, cors);
      }
      const tx = await deps.gateway.transaction(target.transactionId);
      if (tx?.status !== 'VOIDED') return json(200, { result: 'pending' }, cors);
      const outcome = await deps.gateway.record(tx);
      deps.log.info('void_recorded', { outcome, source: 'void' });
      return json(200, { result: 'voided' }, cors);
    } catch {
      return json(503, { error: 'payments_unavailable' }, cors);
    }
  };
}
