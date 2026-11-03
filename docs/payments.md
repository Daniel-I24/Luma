# Payments

Two ways to pay, chosen per order:

- **Pagar al recoger** (`pay_at_pickup`): the default. Nothing changes for it.
- **Pagar en línea** (`online`): Wompi's hosted Web Checkout, opened by
  redirection in the system browser. Off until the owner turns it on
  (`app_settings.payments_enabled = 1`).

Checked against docs.wompi.co on 2026-10-24 (pages: inicio rápido, Web
Checkout, ambientes y llaves, eventos, seguimiento de transacciones,
transacciones, reembolsos sandbox, datos de prueba, errores, métodos de
pago). The API reference page (`/reference`) answered 403 to automated
reads; nothing here depends on it.

## Non-negotiable rules

1. **No payment data touches Luma.** No card, PSE or Nequi field, no Wompi
   script in the app: only a redirect to `https://checkout.wompi.co/p/`.
   The database keeps references, transaction ids, amounts, statuses and
   the method type (`CARD`, `NEQUI`, ...), never card numbers, tokens or
   event bodies.
2. **Every amount comes from the server**: `orders.total_cop` (whole pesos,
   computed by `create_order`) times 100, as an integer in cents. The app
   uses the `Money` value object and never floats.
3. **The integrity signature is made only in an Edge Function**
   (`create-payment`), with the link's expiration inside it.
4. **The redirect is only informative.** A payment is approved only when an
   event passes the whole chain: valid shape and bounded size, SHA-256
   checksum (signature.properties in order, then timestamp, then the events
   secret, compared in constant time), idempotency per event, confirmation
   with the Wompi API, and APPROVED with amount, COP and reference equal to
   the attempt. Old events are **not** rejected for their age (Wompi retries
   up to 24 hours later); replays are stopped by idempotency plus API
   confirmation.
5. **Sandbox and production are separate**: different keys, secrets and
   event URLs; `WOMPI_ENV` (`test` or `prod`) decides, and
   `app_settings.payments_production` must say the same (otherwise
   `payments_misconfigured`). `payments_enabled = 0` turns everything off.
6. **Logs** never contain secrets, signatures, references with personal data,
   emails, names or phones.

## Flow

1. The customer picks "Pagar en línea" and taps "Pagar". The app calls
   `create_order(..., 'online')`: the order starts as `awaiting_payment`,
   invisible to the business, with no owner notification, and it counts as a
   pending order for the limits.
2. The app calls `create-payment` (customer JWT). The function calls
   `prepare_payment(order, WOMPI_ENV)` as that customer: only their own
   online order, not paid, not expired, at most 3 attempts. It returns a new
   unpredictable reference (`luma_` + 32 hex) and the amount in cents; the
   function signs `reference + amount + COP + expiration + integrity secret`
   and answers the checkout URL.
3. The app opens the URL with `@capacitor/browser`. Wompi redirects to
   `luma://payments/return?order=<id>&id=<transaction>`; the app stores the
   transaction id (`record_payment_redirect`, untrusted) and, when it comes
   back to the foreground, reads the order from the server, the only source
   of truth.
4. Wompi POSTs `transaction.updated` to `wompi-webhook`, which runs the
   verifier chain and calls `apply_payment_event` (service role).
5. On approval the order moves to `pending`: the business sees it ("Pagado en
   línea") and the owner is told. Declined or failed attempts leave the order
   waiting; the customer may "Reintentar pago" (3 attempts) or cancel.
6. Orders still unpaid 15 minutes after creation are cancelled by
   `expire_stale_orders`. A payment approved after that becomes
   `refund_required`.
7. `reconcile-payments` (every 5 minutes, and on demand for admins) asks the
   Wompi API about open attempts older than 3 minutes that have a transaction
   id. Wompi documents no search by reference, so attempts without a redirect
   id rely on the webhook.

## Data (migrations 38 to 45)

| Object | Who writes | Notes |
| --- | --- | --- |
| `orders.payment_method` | `create_order` | `pay_at_pickup` or `online` |
| `orders.status` | functions | adds `awaiting_payment` |
| `orders.payment_status` | functions | `none`, `pending`, `approved`, `declined`, `voided`, `refund_required`, `refunded`, `error` |
| `payments` | functions only (closed) | one row per attempt; order, attempt, reference, amount, currency, environment and creation are immutable (trigger); the approved transaction id is set once; no DELETE |
| `payment_events` | functions only | append only for every role (REVOKE plus trigger); unique per transaction and status; outcome `applied`, `ignored`, `mismatch`, `unknown_reference` |

### State machine

`payment_transition_allowed` (SQL) and `PaymentStateMachine` (TypeScript)
are tested with the same 49 vectors
(`supabase/tests/fixtures/payment_transitions.json`):

```
pending          -> approved | declined | error | voided
declined | error -> approved           (Wompi retry of the same reference)
approved         -> voided | refund_required
refund_required  -> refunded | voided
```

Nothing leaves `voided` or `refunded`; an approval never goes back. A late
failure of an older attempt is recorded but never overwrites the order.

## Admin

- `admin_payment_issues()`: refunds pending, mismatching events, errors,
  attempts stuck for over an hour (ids and amounts only). Admin with aal2.
- `void-payment`: Wompi voids only **card** transactions
  (`POST /v1/transactions/{id}/void`, private key; the allowed states and
  window are not documented). Other methods (Nequi, PSE, ...) stay in
  "Reembolsos pendientes": the admin refunds them in the Wompi dashboard and
  then marks them (`admin_mark_refund_done`). Wompi's refunds API is
  documented for the sandbox only, so Luma does not call it.
- Every void request and refund mark goes to `admin_audit_log`.

## Secrets (Edge Functions only)

| Secret | Prefix (sandbox / production) | Used by |
| --- | --- | --- |
| `WOMPI_ENV` | `test` / `prod` | all payment functions |
| `WOMPI_PUBLIC_KEY` | `pub_test_` / `pub_prod_` | `create-payment` (checkout URL) |
| `WOMPI_PRIVATE_KEY` | `prv_test_` / `prv_prod_` | API confirmation, voids |
| `WOMPI_INTEGRITY_SECRET` | `test_integrity_` / `prod_integrity_` | `create-payment` |
| `WOMPI_EVENTS_SECRET` | `test_events_` / `prod_events_` | `wompi-webhook` |

The functions refuse to run when a key's prefix does not match `WOMPI_ENV`.

## Sandbox test data (docs.wompi.co, datos de prueba)

- Cards: `4242 4242 4242 4242` approved, `4111 1111 1111 1111` declined,
  any future expiry and 3-digit CVC; any other card ends in `ERROR`.
- Nequi: `3991111111` approved, `3992222222` declined.
- PSE: "Banco que aprueba" / "Banco que rechaza".

## Merchant credentials: one platform account today

`MerchantCredentials` (Strategy, built by a Factory) has a single
implementation, `PlatformMerchantCredentials`: Luma's own Wompi account
collects every online payment.

Path to one account per restaurant (not implemented):

1. A `business_payment_accounts` table (closed) with each restaurant's
   public key and **references** to its secrets in a secret manager (never
   the secrets in the database).
2. `RestaurantMerchantCredentials` picks the account of the order's
   business; the Factory chooses it when the business has an active account.
3. One events URL per account, or Wompi's per-merchant event routing, with
   the matching events secret.

Legal and tax warnings (to review with an accountant and a lawyer before
going live; not legal advice):

- With one platform account Luma **receives money on behalf of the
  restaurants**: that may make Luma a collection agent, with obligations for
  invoicing (factura electrónica DIAN), withholding (retención en la fuente,
  ICA, IVA where it applies), and payouts to each restaurant, plus
  consumer-protection duties (Ley 1480 de 2011: reversión del pago,
  retracto) and the payment processor's own terms.
- With one account per restaurant each restaurant invoices and collects for
  itself and Luma is only the platform; each restaurant then needs its own
  Wompi contract and KYC.
- Refund, cancellation and chargeback rules must be in the terms and in the
  refund policy (`/legal/refunds`, draft).

## Tests

- SQL: `payments_flow.sql`, `payments_admin.sql`, `create_order_final.sql`.
- Edge Functions and app: listed in phase 2 and 3 (`docs/WORKLOG.md`).
