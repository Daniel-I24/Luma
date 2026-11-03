import { bearerToken, json, preflight, readJson } from '../_shared/edge.ts';
import { CheckoutUrlBuilder } from '../_shared/payments/checkout-url-builder.ts';
import type { MerchantCredentials } from '../_shared/payments/merchant-credentials.ts';
import { Money } from '../_shared/payments/money.ts';
import type { PaymentLog } from '../_shared/payments/payment-log.ts';

/** prepare_payment's answer, or the error code it raised. */
export type Prepared =
  | { readonly reference: string; readonly amountInCents: number; readonly expiresAt: string; readonly attempt: number }
  | { readonly error: string; readonly retryAfterSeconds?: number };

/** What the function may do as the customer (their JWT: RLS and the RPCs decide). */
export interface CustomerPayments {
  emailConfirmed(): Promise<boolean>;
  withinRateLimit(): Promise<boolean>;
  /** The caller's own order (RLS), or null. */
  order(orderId: string): Promise<{ readonly status: string; readonly paymentMethod: string } | null>;
  prepare(orderId: string, environment: string): Promise<Prepared>;
}

export interface CreatePaymentDeps {
  readonly allowedOrigins: readonly string[];
  /** Null when a Wompi secret is missing or does not match WOMPI_ENV. */
  readonly credentials: MerchantCredentials | null;
  readonly redirectUrl: string;
  authenticate(token: string): Promise<CustomerPayments | null>;
  readonly log: PaymentLog;
}

const MAX_BODY_BYTES = 512;
const UUID = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
/** prepare_payment errors and their HTTP status. */
const PREPARE_ERRORS: Readonly<Record<string, number>> = {
  order_not_found: 404, order_not_payable: 409, already_paid: 409, payment_expired: 409,
  too_many_attempts: 409, attempt_in_progress: 409, payments_disabled: 503, payments_misconfigured: 503, email_not_confirmed: 403,
};

/**
 * Where Wompi sends the customer back: the web app itself when the payment
 * started there (an allowed https origin that is not the APK's localhost),
 * the luma:// link of the APK otherwise. A browser cannot open luma://.
 */
function returnUrl(req: Request, deps: CreatePaymentDeps): string {
  const origin = req.headers.get('origin') ?? '';
  if (!deps.allowedOrigins.includes(origin)) return deps.redirectUrl;
  const url = new URL(origin);
  return url.protocol === 'https:' && url.hostname !== 'localhost' ? `${url.origin}/payments/return` : deps.redirectUrl;
}

/**
 * Creates one checkout attempt for the caller's online order and answers the
 * signed Wompi checkout URL. The amount and the reference come from
 * prepare_payment (the database); the app never sends an amount.
 */
export function createHandler(deps: CreatePaymentDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const checked = preflight(req, deps.allowedOrigins);
    if ('response' in checked) return checked.response;
    const { cors } = checked;
    try {
      const token = bearerToken(req);
      if (!token) return json(401, { error: 'unauthorized' }, cors);
      const body = (await readJson(req, MAX_BODY_BYTES)) as { order_id?: unknown } | null;
      const orderId = typeof body?.order_id === 'string' && UUID.test(body.order_id) ? body.order_id.toLowerCase() : null;
      if (!orderId) return json(400, { error: 'invalid_request' }, cors);
      if (!deps.credentials) return json(503, { error: 'payments_unavailable' }, cors);
      const customer = await deps.authenticate(token);
      if (!customer) return json(401, { error: 'unauthorized' }, cors);
      if (!(await customer.emailConfirmed())) return json(403, { error: 'email_not_confirmed' }, cors);
      if (!(await customer.withinRateLimit())) return json(429, { error: 'rate_limited' }, cors);
      const order = await customer.order(orderId);
      if (!order) return json(404, { error: 'order_not_found' }, cors);
      if (order.paymentMethod !== 'online' || order.status !== 'awaiting_payment') {
        return json(409, { error: 'order_not_payable' }, cors);
      }
      const prepared = await customer.prepare(orderId, deps.credentials.environment);
      if ('error' in prepared) {
        deps.log.info('checkout_refused', { outcome: prepared.error, source: 'checkout' });
        const error = prepared.error in PREPARE_ERRORS ? prepared.error : 'payments_unavailable';
        // attempt_in_progress: the latest attempt is still open; the app shows how long to wait.
        const wait = prepared.retryAfterSeconds;
        return wait === undefined
          ? json(PREPARE_ERRORS[prepared.error] ?? 503, { error }, cors)
          : json(409, { error, retry_after_seconds: wait }, { ...cors, 'Retry-After': String(wait) });
      }
      const url = await new CheckoutUrlBuilder(deps.credentials)
        .withReference(prepared.reference)
        .withAmount(Money.fromCents(prepared.amountInCents))
        .withRedirectUrl(`${returnUrl(req, deps)}?order=${orderId}`)
        .expiringAt(new Date(prepared.expiresAt))
        .build();
      deps.log.info('checkout_created', { source: 'checkout', count: prepared.attempt });
      return json(200, {
        checkout_url: url, expires_at: prepared.expiresAt, attempt: prepared.attempt,
        sandbox: deps.credentials.environment === 'test',
      }, cors);
    } catch {
      deps.log.info('checkout_failed', { source: 'checkout' });
      return json(503, { error: 'payments_unavailable' }, cors);
    }
  };
}
