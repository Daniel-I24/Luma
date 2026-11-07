# Wompi in sandbox: step-by-step setup

The design, the rules and the round-4 safeguards are in docs/payments.md;
the go-live checks in docs/payments-checklist.md. This page is only the
order of the owner's steps to try **sandbox** payments. Online payments
stay off (`payments_enabled = 0`) until step 6. Never use production keys
here.

## 1. Wompi sandbox account

1. https://comercios.wompi.co → sign up and switch to **Sandbox**.
2. Developers: copy the four sandbox keys (`pub_test_`, `prv_test_`,
   `test_integrity_`, `test_events_`).
3. Events URL: `https://<ref>.supabase.co/functions/v1/wompi-webhook`.

## 2. Secrets (Edge Functions only, never in the app)

```sh
openssl rand -hex 32            # PAYMENTS_CRON_SECRET, used again at step 4
supabase secrets set WOMPI_ENV=test WOMPI_PUBLIC_KEY=pub_test_... WOMPI_PRIVATE_KEY=prv_test_... \
  WOMPI_INTEGRITY_SECRET=test_integrity_... WOMPI_EVENTS_SECRET=test_events_... PAYMENTS_CRON_SECRET=<64 hex>
```

The functions refuse a key whose prefix does not match `WOMPI_ENV`.

## 3. Deploy the four functions

```sh
supabase functions deploy create-payment
supabase functions deploy void-payment
supabase functions deploy wompi-webhook --no-verify-jwt
supabase functions deploy reconcile-payments --no-verify-jwt
```

## 4. Reconciliation every few minutes (pg_cron)

```sql
insert into private.payments_cron (function_url, secret)
values ('https://<ref>.supabase.co/functions/v1/reconcile-payments', '<the same secret>')
on conflict do nothing;
```

## 5. Validate one real sandbox event

Follow "Before enabling: validate one real sandbox event" in
docs/payments.md (`npm run check:wompi-event`). Only an "OK" lets you go on.

## 6. Turn payments on (sandbox)

```sql
update public.app_settings set int_value = 1 where key = 'payments_enabled';
-- payments_production stays 0 while WOMPI_ENV=test
```

## 7. Try it

Pay an order with the sandbox data of docs/payments.md (approved card,
declined card, Nequi), then answer the four questions of
docs/payments-checklist.md ("Sandbox questions to settle") and write each
result there.

## 8. What a phone cannot test

Pay one order in the sandbox, copy its transaction id from the Wompi dashboard, and:

```powershell
npm run wompi:replay -- <transaction id>
```

It sends that real transaction to `wompi-webhook` with a forged signature (must be
refused), repeated, and a day late (no effect). It reads the sandbox events secret from
`luma-secrets` and refuses anything else.

## Turning it off again

`update public.app_settings set int_value = 0 where key = 'payments_enabled';`
— the app hides "Pagar en línea" at once; orders already paid keep their state.
