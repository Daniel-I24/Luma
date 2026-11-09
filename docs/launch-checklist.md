# Launch checklist (only what the owner does)

State on 2026-11-07 (round 14). Commands are for **PowerShell** in `C:\dev\Luma`. Secrets stay in
`%USERPROFILE%\luma-secrets` and are loaded only by `scripts\luma.ps1`; never paste a
`service_role` key or a private key in the app, the repository or a chat.

## Done

- Migrations 1 to 64 applied; cron jobs `luma-expire-stale-orders` and `luma-reconcile-payments`
  scheduled.
- `scripts\luma.ps1` option 8 in OK: Luma IA (Gemini), push (Firebase), Wompi sandbox, routes
  (OpenRouteService), WhatsApp, `delete-account`, `geocode` and `verify-website`.
- Web on Vercel (`https://luma-ten-henna.vercel.app`) with `SUPABASE_URL` and
  `SUPABASE_ANON_KEY`; a clean clone builds (CI job `clean-build`).
- On the phone: push in the Android bar; sandbox card approved and declined, Nequi approved and
  declined, PSE approved; the app returns from Wompi.
- Own SMTP (Gmail) in Supabase, limit raised to 30 emails per hour: sign-up works with external
  addresses (docs/auth-emails.md).

## Now (before the presentation)

1. **Push the commits:** `git push origin main`. CI must turn green.
2. **Apply migrations 65 and 66** (`20261115000000_abandoned_payments.sql`,
   `20261116000000_foreign_key_indexes.sql`) after reading them:
   ```powershell
   npx.cmd --yes supabase@3.0.0 db push --remote --dry-run
   npx.cmd --yes supabase@3.0.0 db push --remote --yes
   npx.cmd --yes supabase@3.0.0 migration list --remote
   ```
   Check: both show as applied. About 35 minutes later, "Pagos con problemas" no longer lists the
   attempts that never reached Wompi.
3. **Deploy `reconcile-payments`:** option 3 (or 8) of `scripts\luma.ps1`.
   Check: Admin → Operaciones → "Conciliar ahora" answers with a number.
4. **APK:** option 6 of `scripts\luma.ps1`. It prints `APK: compilado <date time>` and installs it.
   Publish it as release v1.0.1 on GitHub, so the README's "última versión" downloads it.
5. **iPhone:** the web already works from Safari. The native app needs a Mac (docs/ios.md); before
   compiling it, run option 3 or 8 of `scripts\luma.ps1` so `ALLOWED_ORIGINS` includes it.
6. **Rehearse** `docs/demo.md` once with the three demo accounts.

## Before real users

1. **Wompi production:** the decision on whose account receives the money (one platform account or
   one per business, docs/payments.md), the production keys in `luma-secrets`, the events URL in the
   Wompi dashboard, `payments_production = 1`, and the list in docs/payments-checklist.md again.
2. **Legal review** of the terms, privacy and refund policy (docs/legal-notes.md), the controller's
   name and NIT, the maximum refund times, then remove the draft notice.
3. **Email volume:** Gmail is enough for the presentation and first tests. Before opening to the
   public, move to a transactional provider with your own domain and SPF, DKIM and DMARC, and raise
   the hourly limit to match (docs/auth-emails.md).
4. **Meta in live mode** for WhatsApp verification (docs/meta-live.md).
5. **Signed APK** with your keystore (the four `LUMA_KEY*` values in `app.env`, option 6) and the
   store listing (docs/release.md).
6. **Firebase service account:** once the last `push-dispatch` deploy is done, move
   `firebase-service-account.json` out of `luma-secrets` to an offline backup; options 2 and 8 need
   it only to deploy.
7. **Backups:** Supabase → Database → Backups, before each migration.
