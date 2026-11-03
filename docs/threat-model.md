# Threat model

Scope: the Luma app (web and Android), Supabase (database, auth, storage,
Edge Functions) and the services it calls (Wompi, FCM, geocoding, LLM).
Method: STRIDE per asset; each threat names its control and where it is
tested. Reviewed 2026-10-26.

## Assets

| Asset | Why it matters |
| --- | --- |
| Customer data: name, phone, residence, avatar, orders | Personal data (Colombian Ley 1581 de 2012) |
| Business data: tax id, address, menu, sales | Commercial; tax id and phone are identity signals |
| Money: order totals, payment attempts and statuses | Fraud and chargebacks |
| Admin powers: approve/suspend businesses, void, mark refunds, clear strikes | Abuse affects everyone |
| Secrets: service_role, Wompi keys and secrets, FCM account, LLM and geocoding keys, cron and push secrets | Full compromise |

## Actors

Anonymous visitor; customer; business owner; admin; Wompi (events);
database webhooks and cron; a stolen phone; a malicious owner or customer;
an attacker with the public anon key and project URL (both are public by
design).

## Threats and controls

| # | Threat (STRIDE) | Control | Tested in |
| --- | --- | --- | --- |
| T1 | Spoofing: someone calls an RPC as another user | RLS and `auth.uid()` in every function; anon has no EXECUTE on private functions | SQL suites `*_security.sql`, `round1_hardening.sql` |
| T2 | Spoofing: forged Wompi event marks an order paid | Checksum with the events secret, constant-time compare, Wompi API confirmation, amount/currency/reference equality, idempotency | Deno `payment-event-verifier`, `wompi-webhook` tests; `payments_flow.sql`; 49 transition vectors |
| T3 | Tampering: the app sends a lower price | Prices computed in `create_order`; payment amount from `orders.total_cop` | `create_order_final.sql` |
| T4 | Tampering: customer forges the redirect (`luma://payments/return?status=APPROVED`) | Redirect is informative; the app re-reads the order; only events/reconciliation change status | `payment-return` spec, `payments_flow.sql` |
| T5 | Repudiation: an admin denies a decision | Append-only `admin_audit_log` via `log_admin_action`; aal2 required | `admin_mfa_audit.sql` |
| T6 | Information disclosure: an owner sees other customers' data | Owners see only their orders' customer display data; phone and residence never shared; avatar only with consent, signed URL | `customer_profile.sql`, avatar specs |
| T7 | Information disclosure: secrets in the repository | `secret-scan.mjs` in CI; env files ignored; history report | docs/security-findings.md |
| T8 | Information disclosure: raw backend errors in the UI | Errors mapped to translation keys | repository specs |
| T9 | Denial of service / cost: spamming menu scans, payments, LLM | `hit_rate_limit` buckets, LLM quotas and cache, image size bounds before decoding | `rate_limits.sql`, `extract-menu` tests |
| T10 | Fraud: fake orders from new accounts, no-shows | Phone required, trust tiers limit open orders, strikes after "No llegó", profile completeness | `trust_tiers.sql` |
| T11 | Fraud: duplicate or impersonating businesses | Review flags (tax id taken, phone keys, similar name near), admin approval | `business_signals.sql` |
| T12 | Elevation: stolen admin password | TOTP MFA, `is_admin()` false below aal2 | `admin_mfa_audit.sql` |
| T13 | Elevation: function search_path hijack | `SECURITY DEFINER` with `set search_path = ''`/fixed | migration review, `verify-backend` |
| T14 | Webhook/cron endpoints called by anyone | `verify_jwt = false` only with a secret or signature; others need a JWT | handler tests per function |
| T15 | Stolen phone with an open session | Session in app-private storage; sign out everywhere; no card data stored | DECISIONS (SecureSessionStorage) |
| T16 | Push notification spoofing or leaks | Only `push-dispatch` sends (secret); texts carry no personal data | `push-dispatch` tests |

## Residual risks

- History contains the Supabase project reference (no keys); see
  docs/security-findings.md.
- Refunds are manual in Wompi's dashboard (the app marks
  `refund_required`); a human must act.
- Dev-only dependency advisories accepted in docs/security-notes.md.
- The session token is readable by anyone with root on the device.
