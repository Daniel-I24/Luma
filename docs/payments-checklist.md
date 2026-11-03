# Payments checklist

What must hold before and after turning on online payments
(`app_settings.payments_enabled = 1`). Design and flows: docs/payments.md.

## Code (verified in this repository)

- [x] No card, PSE or Nequi field and no Wompi script in the app; only the
      hosted checkout URL in the system browser (`WompiGateway`,
      `@capacitor/browser`).
- [x] Amount in cents from `orders.total_cop` on the server (`Money`, no
      floats); currency COP only.
- [x] Integrity signature only in `create-payment`, with expiration.
- [x] Events: bounded size and shape, checksum with the events secret in
      constant time, idempotency (`payment_event_seen`), confirmation with
      `GET /v1/transactions/{id}`, amount/currency/reference equality.
- [x] Allowed status transitions only (`payment_transition_allowed`, 49
      vectors shared by SQL and Deno tests).
- [x] Reconciliation of pending attempts (`reconcile-payments`, cron
      secret or admin aal2).
- [x] Void only for cards and only by an admin (aal2); refunds are marked
      `refund_required` and done by hand.
- [x] Rate limit on `create_payment` (10 per 10 minutes).
- [x] Logs without secrets, signatures, tokens or event bodies.
- [x] Sandbox banner in the app while `payments_production = 0`.

## Configuration (owner, before enabling)

- [ ] Secrets set for the right environment: `WOMPI_ENV`, public and
      private keys, integrity and events secrets (test and prod are
      different), `PAYMENTS_CRON_SECRET`, `ALLOWED_ORIGINS`.
- [ ] `app_settings.payments_production` matches `WOMPI_ENV` (otherwise
      the app shows `payments_misconfigured`).
- [ ] Events URL in Wompi's dashboard points to `wompi-webhook` of the same
      project and environment.
- [ ] Cron for `reconcile-payments` scheduled (migration
      `20261030000700_payment_service`).
- [ ] Refund policy published (`/legal/refunds`) and reviewed by counsel.

## Sandbox run (before production)

- [ ] Approved card: order goes to paid only after the event.
- [ ] Declined card and Nequi decline: order stays awaiting payment, retry
      works, at most 3 attempts.
- [ ] Closing the checkout without paying: the order expires as configured.
- [ ] Replaying an old event: no change (idempotent).
- [ ] Event with a wrong checksum: 401, nothing changes.
- [ ] Cancelling a paid order: `refund_required` appears in
      /admin/operations.
- [ ] Reconciliation fixes an attempt whose event was lost.

## After going live

- [ ] Watch /admin/operations daily during the first week.
- [ ] Rotate Wompi secrets if they were ever shared outside the
      dashboard and the Supabase secrets.

## Sandbox questions to settle (round 4)

Each point has what the Wompi docs say (docs.wompi.co, read 2026-10-28)
and a **Result** line to fill in during the sandbox run. Until a result is
written, the app keeps the current, safe behaviour shown here.

1. **`luma://` as redirect-url, and how Wompi adds the id when the URL
   already has `?order=`.** create-payment sends
   `redirect-url=luma://payments/return?order=<uuid>`. The docs only show an
   https URL "que debe pertenecer a tu sitio web" and the id appended as
   `?id=<transaction>`; custom schemes and URLs that already carry a query
   are not mentioned. Check: pay in the sandbox from the APK and look at
   the URL the app receives (`adb logcat | Select-String "luma://"`).
   Expected: `luma://payments/return?order=<uuid>&id=<tx>` (PaymentReturn
   reads both). If Wompi refuses the scheme or breaks the query, use plan B
   below.
   **Result:** pending.
2. **Void: request body and response.** Documented:
   `POST /v1/transactions/{id}/void` with the private key, cards only, "solo
   disponible para ciertos estados". No body and no response shape are
   documented; `WompiApi.void` sends no body and treats any 2xx as accepted,
   then re-reads the transaction (`GET /v1/transactions/{id}`) and only a
   `VOIDED` status changes anything. Check: void an approved sandbox card
   payment from /admin/operations and write down the status code and body.
   **Result:** pending.
3. **Minimum amount.** Not documented (the docs only require a positive
   integer `amount_in_cents`). Nothing was added: if the sandbox refuses a
   small amount, add `app_settings.payments_min_total_cop` with that value
   in a new migration and make `create_order` refuse online orders below it
   (`payment_below_minimum`). Check: an online order of $1.000 COP.
   **Result:** pending.
4. **Reconciliation by reference.** Not documented: the only query is
   `GET /v1/transactions/{id}` (private key). So `payments_to_reconcile`
   lists pending attempts without a redirect id (older than 3 minutes) with
   `transaction_id = null`, and `reconcile-payments` skips them: the
   webhook settles them, and after an hour they appear in
   /admin/operations as "stuck_pending". If Wompi confirms a search by
   reference (for example `GET /v1/transactions?reference=`), use it in
   `Reconciler` and keep the check that the returned reference equals the
   attempt's.
   **Result:** pending.

Also check in the sandbox: two attempts paid for one order (pay, close
the checkout before the redirect, wait 3 minutes, retry and pay again):
the second becomes `refund_required`, the customer gets "Detectamos un
cobro duplicado…" and the admins "Hay un reembolso pendiente de hacer".

### Plan B: an https return page on GitHub Pages (free)

If Wompi only accepts https redirect URLs, publish this page (for example
`https://<usuario>.github.io/luma-pago/`) and set `APP_PAYMENT_RETURN_URL`
in `supabase/functions/create-payment/index.ts` (`APP_PAYMENT_RETURN_URL`) to it. The page only
forwards the query to the app; it never reads or stores anything.

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>Volver a Luma</title>
</head>
<body>
  <p>Volviendo a Luma… <a id="open" href="luma://payments/return">Abrir Luma</a></p>
  <script>
    // Keeps order and id (only these, only safe characters) and opens the app.
    var q = new URLSearchParams(location.search), out = new URLSearchParams();
    ['order', 'id'].forEach(function (k) {
      var v = q.get(k);
      if (v && /^[0-9A-Za-z_-]{1,64}$/.test(v)) out.set(k, v);
    });
    var target = 'luma://payments/return' + (out.toString() ? '?' + out.toString() : '');
    document.getElementById('open').href = target;
    location.replace(target);
  </script>
</body>
</html>
```

Steps: new public repository → add it as `index.html` → Settings → Pages
→ deploy from the main branch → use the https URL as the redirect. The
app already accepts `luma://payments/return?order=…&id=…` (PaymentReturn).
