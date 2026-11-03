# Security overview

How Luma protects its users, their data and their money. Details per area
live in the linked documents; rules for contributors are in
`.kiro/steering/security.md` and `CLAUDE.md`.

## Principles

1. **The database decides.** Every table has RLS; the app holds only the
   anon key and the user's JWT. Writes that need rules (orders, prices,
   payments, reviews, admin decisions) are `SECURITY DEFINER` functions
   with a fixed `search_path`, explicit grants and `REVOKE EXECUTE` from
   `PUBLIC`/`anon` (docs/migrations.md).
2. **Secrets never reach the client.** `service_role`, Wompi private keys
   and secrets, LLM keys, FCM service account, geocoding key and cron
   secrets exist only as Edge Function secrets. The client config has the
   project URL and anon key only.
3. **Prices and amounts are computed on the server** (`create_order`,
   `prepare_payment`); the app never sends a price.
4. **No card data.** Online payments use Wompi's hosted checkout in the
   system browser; the database keeps references and statuses only
   (docs/payments.md).
5. **Least privilege for people too.** Admin functions require `is_admin()`
   with an `aal2` session (TOTP), and every admin action is written to an
   append-only audit log.

## Authentication and accounts

- E-mail and password with confirmation by code; unconfirmed e-mails never
  get a session in the app and the database refuses their writes.
- Admin: TOTP MFA (`/admin/mfa`), `aal2` checked in SQL.
- Abuse limits: `hit_rate_limit(bucket)` per user (menu scans, payments,
  more in `app_settings`); trust tiers and strikes limit open orders for
  customers who do not pick up (migrations `..._trust_tiers`, `..._trust_status`).
- Account deletion: `delete-account` function (user JWT), data export
  `export_my_data`.

## Edge Functions

| Function | Caller | Protection |
| --- | --- | --- |
| `create-payment`, `void-payment`, `geocode`, `extract-menu`, `recommend`, `suggest-promotions`, `delete-account` | the app | `verify_jwt = true`, then SQL checks the caller (owner, admin aal2, rate limits) |
| `wompi-webhook` | Wompi | `verify_jwt = false`; SHA-256 event checksum with the events secret (constant-time compare), idempotency, confirmation with the Wompi API |
| `reconcile-payments` | cron or an admin | `verify_jwt = false`; `x-cron-secret` (constant-time) or an admin JWT checked by `admin_note_reconcile` |
| `push-dispatch` | database webhook | `verify_jwt = false`; `PUSH_DISPATCH_SECRET` |

CORS: `ALLOWED_ORIGINS`. Logs never contain secrets, signatures, tokens or
event bodies.

## App and device

- Android: no backup, no cleartext traffic, only the main activity
  exported, `luma://payments` deep link carries no data that is trusted
  (the order is re-read from the server).
- Session storage: Supabase's default (WebView `localStorage`, app-private
  on Android). Evaluated against an encrypted store in DECISIONS
  ("SecureSessionStorage").
- No user-visible error shows a raw backend message; errors map to
  translation keys.
- Third-party URLs live only in `core/config/external-urls.ts`
  (`check:hardcoded-urls`).

## Repository hygiene

- `node scripts/secret-scan.mjs` in CI (tracked files);
  `npm run scan:history` for the history (docs/security-findings.md).
- CodeQL (`.github/workflows/codeql.yml`) on pushes, pull requests and
  weekly.
- `npm audit --omit=dev` must be 0; dev-only accepted risks in
  docs/security-notes.md. Dependabot weekly.

## Public and private business data (round 5)

| Data | Who sees it |
| --- | --- |
| Name, category, address, location, hours, menu, photos | Anyone, once the business is approved and published |
| Contacts (phone, WhatsApp, Instagram, Facebook, website) | The app shows a customer only the verified ones, with a badge. The raw columns stay readable through the API as before (public data entered by the owner) |
| `<kind>_verified_at` | Readable; only `admin_verify_contact` writes them (no column grant for owners) |
| Verification codes (`contact_verifications`) | The owner of the business and the review team; never customers |
| Trust summary (`business_trust_summary`) | Signed-in users: verified since, verified contact kinds, completed orders as a range (0, 1-10, 11-50, 51-200, 200+), months on Luma |
| NIT, legal name, legal representative, documents | Only the owner and the review team (RLS, private bucket); never in the trust summary |
| Customers' names, phones and avatars | Never public; a business sees only what an order of theirs needs |

## Automatic contact verification (round 6)

- `whatsapp-webhook` (`verify_jwt = false`): the HMAC SHA-256 of the raw
  body (`X-Hub-Signature-256`, App Secret) is checked in constant time
  before parsing; only text messages with a strict `LUMA-XXXXXX`; only
  `service_role` may call `verify_contact_from_whatsapp`; no number or text
  stored (id for 7 days, sender HMAC for the limits).
- `verify-website`: SSRF rules in `supabase/functions/verify-website/ssrf.ts`;
  residual DNS rebinding risk in docs/whatsapp-setup.md.
- Both are inert until their flags are on and their secrets set.

## Related documents

- [Threat model](threat-model.md)
- [Payments checklist](payments-checklist.md)
- [Findings in the repository and history](security-findings.md)
- [Dependency notes and accepted risks](security-notes.md)
