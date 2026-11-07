import { bearerToken, json, preflight } from '../_shared/edge.ts';
import type { PaymentLog } from '../_shared/payments/payment-log.ts';
import type { ReconcileReport } from '../_shared/payments/reconciler.ts';
import { SecureCompare } from '../_shared/secure-compare.ts';

export interface ReconcileDeps {
  /** ALLOWED_ORIGINS: the admin calls it from the web and the APK; the cron sends no Origin. */
  readonly allowedOrigins: readonly string[];
  /** PAYMENTS_CRON_SECRET; the same value as private.payments_cron.secret. */
  readonly cronSecret: string | null;
  /** True when the JWT belongs to an admin with aal2 (admin_note_reconcile, which logs it). */
  isAdmin(token: string): Promise<boolean>;
  /** Null when a Wompi secret is missing. */
  readonly run: (() => Promise<ReconcileReport>) | null;
  readonly log: PaymentLog;
}

const MIN_SECRET_LENGTH = 32;

/**
 * Called every 5 minutes by pg_cron (x-cron-secret) and on demand by an
 * admin with aal2 (JWT). verify_jwt = false because the cron has no JWT.
 * The browser asks first (OPTIONS): without CORS it never sends the admin's POST.
 */
export function createHandler(deps: ReconcileDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const checked = preflight(req, deps.allowedOrigins);
    await req.body?.cancel();
    if ('response' in checked) return checked.response;
    const { cors } = checked;
    const cron = req.headers.get('x-cron-secret');
    const token = bearerToken(req);
    const byCron = cron !== null && deps.cronSecret !== null && deps.cronSecret.length >= MIN_SECRET_LENGTH
      && SecureCompare.equal(cron, deps.cronSecret);
    try {
      if (!byCron && !(token && (await deps.isAdmin(token)))) return json(401, { error: 'unauthorized' }, cors);
      if (!deps.run) return json(503, { error: 'payments_unavailable' }, cors);
      const report = await deps.run();
      deps.log.info('reconciled', { source: 'reconcile', count: report.applied });
      return json(200, report, cors);
    } catch {
      deps.log.info('reconcile_failed', { source: 'reconcile' });
      return json(503, { error: 'payments_unavailable' }, cors);
    }
  };
}
