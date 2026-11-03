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
