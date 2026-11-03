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
`PAYMENTS_CRON_SECRET` (at least 32 characters, `openssl rand -hex 32`) lets
pg_cron call `reconcile-payments`; the same value goes in
`private.payments_cron` (migration 49).

## Edge Functions (`supabase/functions`)

| Function | `verify_jwt` | Does |
| --- | --- | --- |
| `create-payment` | true | customer JWT, confirmed email, CORS allow list, 512-byte body `{ order_id }`, rate limit `create_payment` (10 per 10 minutes), checks the order with the customer's own client (RLS), calls `prepare_payment`, answers `{ checkout_url, expires_at, attempt, sandbox }` |
| `wompi-webhook` | **false** | POST, `application/json`, at most 64 KB, then the verifier chain (schema, checksum, idempotency, API confirmation, match); every rejection answers `400 {}`; `200 {}` only after processing |
| `reconcile-payments` | **false** | `x-cron-secret` or an admin JWT with aal2 (logged); asks the API about open attempts with a transaction id older than 3 minutes |
| `void-payment` | true | admin JWT with aal2; card: void by API, confirm VOIDED, record it; other methods: `{ result: 'manual' }` |

Shared code (`_shared/payments`): `Money`, `PaymentStateMachine`,
`IntegritySignature`, `CheckoutUrlBuilder` (Builder), `MerchantCredentials`
with `PlatformMerchantCredentials` and `MerchantCredentialsFactory`
(Strategy and Factory), `WompiApi` (Adapter), `WompiEventParser` and
`EventChecksum`, `PaymentEventVerifier` (chain of responsibility:
`SchemaStep`, `ChecksumStep`, `IdempotencyStep`, `ApiConfirmationStep`,
`MatchAndApplyStep`), `PaymentApplier`, `Reconciler`, `PaymentRepository`
with `SupabasePaymentRepository`, `PaymentLog` (typed fields, codes only).
Provider URLs: `_shared/config/provider-urls.ts`; app link:
`_shared/config/app-links.ts` (`luma://payments/return`).

## Setting it up (owner, in order)

1. Wompi dashboard (sandbox first): copy the four keys and set the events
   URL to `https://<ref>.supabase.co/functions/v1/wompi-webhook`.
2. `supabase secrets set WOMPI_ENV=test WOMPI_PUBLIC_KEY=... WOMPI_PRIVATE_KEY=... WOMPI_INTEGRITY_SECRET=... WOMPI_EVENTS_SECRET=... PAYMENTS_CRON_SECRET=<64 hex>`.
3. Deploy the four functions with their flags (docs/deploy.md).
4. SQL editor: `insert into private.payments_cron (function_url, secret) values ('https://<ref>.supabase.co/functions/v1/reconcile-payments', '<same secret>');`
5. `update public.app_settings set int_value = 1 where key = 'payments_enabled';`
6. Try every sandbox case below; for production repeat with `WOMPI_ENV=prod`,
   the production keys and events URL, and
   `update public.app_settings set int_value = 1 where key = 'payments_production';`.

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

- SQL: `payments_flow.sql`, `payments_admin.sql`, `payment_service.sql`, `create_order_final.sql`.
- Deno: `_shared/payments` (documented integrity vector, checksum steps,
  tampered data, wrong secret, wrong environment, amount, currency and
  reference mismatches, repeated and old events, missing transaction, fake
  API answers, the 49 shared vectors, log redaction), `create-payment`,
  `wompi-webhook` (huge body, malformed JSON, identical rejections, logs
  without secrets or personal data), `reconcile-payments`, `void-payment`.
- App: `payments.spec.ts` (gateways, only Wompi links open, return-link
  parsing and handling), `order-payment.store.spec.ts`,
  `checkout.store.spec.ts` (online only when enabled).

## In the app

- `PaymentRepository` (`shared/payments`): `payment_config`,
  `my_order_payment`, `create-payment`, `record_payment_redirect`.
- `PaymentGatewayFactory` (Strategy and Factory): `PayAtPickupGateway` and
  `WompiGateway`, which opens the checkout with `ExternalBrowser`
  (`@capacitor/browser`, system browser) and only for URLs that start with
  `ExternalUrls.WOMPI_CHECKOUT`.
- Checkout: "¿Cómo pagas?" with "Pagar al recoger" and, only when
  `payment_config.enabled`, "Pagar en línea"; in the sandbox the banner
  "Modo de pruebas: no se cobra dinero real" with the test card and Nequi.
- Order screen: `OrderPayment` shows the server's status, attempts left,
  "Pagar" / "Reintentar pago" (3 attempts, 15 minutes) and "Cancelar pedido";
  it re-reads the order when the app returns to the foreground
  (`AppEvents.resumes`). The list shows "Completar pago".
- `luma://payments/return?order=<id>&id=<transaction>` is registered in
  `AndroidManifest.xml`; `PaymentReturn` stores the transaction id and opens
  the order. Nothing is approved by the link.
- Owners see "Pagado en línea" on the order card and never mark a payment.
- Legal drafts: `/legal/refunds` (payments and refunds policy) and Wompi as
  processor in the privacy draft.

## Before enabling: validate one real sandbox event

Online payments stay off (`payments_enabled = 0`) until a **real event
from Wompi's sandbox** has been checked against our checksum algorithm:

1. In the sandbox, pay a test order (test card) with the events URL
   pointing to `wompi-webhook`.
2. Wompi dashboard (sandbox) → Eventos: copy the JSON of the
   `transaction.updated` event into a file, e.g. `event.json` (outside the
   repository). Note the `X-Event-Checksum` header if the dashboard shows it.
3. In PowerShell:

   ```powershell
   $env:WOMPI_EVENTS_SECRET = Read-Host "Sandbox events secret"
   npm run check:wompi-event -- C:\ruta\event.json
   # or, with the header: npm run check:wompi-event -- C:\ruta\event.json --checksum <X-Event-Checksum>
   Remove-Item Env:WOMPI_EVENTS_SECRET
   ```

The script computes the documented checksum (values of
`signature.properties` in order, then `timestamp`, then the secret,
SHA-256) and a few variants, marks the one that matches and never prints
the secret. Only "OK: the documented algorithm … matches" allows going on
with docs/payments-checklist.md; any other answer means a wrong secret,
the wrong environment, or a change in Wompi's algorithm to investigate
before enabling payments.

## Round 4 safeguards (migration `20261101000000_round4_hardening`)

- **One attempt at a time.** `prepare_payment` refuses `attempt_in_progress`
  while the latest attempt is `pending` and younger than
  `app_settings.payment_retry_wait_seconds` (180); the error hint carries
  the seconds left, create-payment answers 409 with `retry_after_seconds`
  and `Retry-After`, and the app disables "Reintentar pago" with "Podrás
  reintentar en m:ss". The order lock serialises two attempts prepared at
  the same time. Expired, no attempts left and already paid also disable
  the button with their cause.
- **Duplicate charge.** If an order already has an approved payment and
  the approval of ANOTHER attempt arrives, that payment becomes
  `refund_required` through `private.flag_payment_refund` (the same
  per-payment step `mark_refund_required` uses), the order keeps its
  status and payment status, the customer gets `duplicate_charge` and every
  admin `refund_pending_admin`. Voiding or refunding the duplicate never
  touches the order; `admin_mark_refund_done` sets the order to `refunded`
  only when no payment of it is left approved or to refund.
- **Lock order.** Every path that changes a payment locks the order first
  and then the payment: `apply_payment_event` resolves `order_id` from the
  reference without a lock (both columns are immutable), then locks the
  order, then the payment; cancellations lock the order (their UPDATE) and
  the `orders_paid_cancelled` trigger then locks the payments. The SQL
  harness runs one session, so this is checked by the code path, not by a
  concurrent test.
- **Closed table.** `payments` has no grant for `service_role` either; only
  SECURITY DEFINER functions read or write it.
- **Void** (`admin_request_void`) only for `refund_required` payments or
  approved payments of cancelled orders.
- **Reconciliation** also lists pending attempts without a redirect id
  (older than 3 minutes) with a null transaction id. Wompi documents no
  search by reference, so `reconcile-payments` skips them (see
  docs/payments-checklist.md, question 4).
