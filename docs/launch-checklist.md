# Launch checklist

Everything the owner does by hand, in order, to put Luma online on Vercel,
your Supabase project and a signed APK. Nothing in the repository deploys
by itself. Tick each box; stop at the first failure and see
[runbook.md](runbook.md).

## 0. Before touching production

- [ ] Supabase Dashboard → Database → Backups: confirm a recent backup exists
      (or download one with `supabase db dump`).
- [ ] Pull `main` and run locally: `npm ci`, `npm run build`, `npx ng lint`,
      `npm test -- --watch=false`, `npm run test:scripts`. All green.
- [ ] Compare the applied migrations with [migrations.md](migrations.md):
      `supabase migration list` (or `select version from
      supabase_migrations.schema_migrations order by 1`). Only the four
      marked "Applied" should be there.

## 1. Database

- [ ] Database → Extensions: enable `pg_cron` and `pg_net` (optional but
      recommended: expiry of stale orders and push notifications).
- [ ] Apply migrations 5 to 28 in filename order: `supabase db push` with the
      project linked, or paste each file in the SQL editor (UTF-8). Stop at
      the first error.
- [ ] SQL editor: run `supabase/sql/validate-report.sql`. Fix or delete the
      rows it counts, then run the `validate constraint` commands of
      [migrations.md](migrations.md).
- [ ] Create the first admin (your own account, after signing up and
      confirming it): `insert into public.admins (user_id) select id from
      auth.users where email = '<your email>';` ([admin.md](admin.md)).

## 2. Auth (fixes the phone finding "link to localhost")

- [ ] Authentication → Sign In / Providers → Email: **Confirm email ON**.
- [ ] Authentication → Emails → Templates: paste the "Confirm signup" and
      "Reset password" templates of [auth-emails.md](auth-emails.md). Neither
      may contain `{{ .ConfirmationURL }}`; OTP length 6, expiry 1 hour.
- [ ] Authentication → Emails → SMTP Settings: your own SMTP (SES, Brevo,
      Postmark, Resend…) with SPF, DKIM and DMARC. The built-in sender only
      reaches team addresses.
- [ ] Authentication → URL Configuration → Site URL: `https://<vercel-domain>`.
- [ ] Sign up a test account from a phone: the email shows a **6-digit
      code**, no link.

## 3. Edge Functions and secrets

- [ ] `supabase secrets set ALLOWED_ORIGINS=https://localhost,https://<vercel-domain>`
- [ ] Deploy and configure as in [deploy.md](deploy.md#edge-functions):
      `delete-account`, `geocode` ([geocode.md](geocode.md)), and the
      optional ones: `recommend`, `suggest-promotions`, `extract-menu`
      ([ai.md](ai.md)), `push-dispatch` ([push.md](push.md)).
- [ ] Push only: insert `private.push_settings` (URL + the same secret).
- [ ] `SUPABASE_URL=… SUPABASE_ANON_KEY=… APP_ORIGIN=https://<vercel-domain> npm run verify:backend`
      → `verify-backend: ok`.
- [ ] Luma IA only: `SMOKE_EMAIL=… SMOKE_PASSWORD=… SMOKE_BUSINESS_ID=… node scripts/ai-smoke.mjs --menu`
      with a confirmed **test** account.

## 4. Web (Vercel)

- [ ] Project → Settings → Environment Variables (Production and Preview):
      `SUPABASE_URL`, `SUPABASE_ANON_KEY` (anon/publishable key only).
- [ ] Deploy `main`. Open `https://<vercel-domain>`: the app loads, the map
      shows tiles, sign-in works.
- [ ] Response headers (DevTools → Network → document): CSP, HSTS,
      `X-Frame-Options: DENY`; `/version.json` has `Cache-Control: no-store`.
- [ ] Optional switches, each a one-line change plus a deploy:
      `AI_MODE` → `'remote'` (`src/app/core/config/ai-mode.ts`) after step 3.

## 5. Android APK

Follow [release.md](release.md):

- [ ] Your keystore (never in git) and the four `LUMA_KEY*` variables.
- [ ] `UPDATE_SITE_URL` → `'https://<vercel-domain>'`
      (`src/app/core/config/update-check-url.ts`) so the APK can see updates.
- [ ] Push only: `android/app/google-services.json` (never in git) and
      `PUSH_ENABLED` → `true` (`src/app/core/config/push-enabled.ts`).
- [ ] `SUPABASE_URL=… SUPABASE_ANON_KEY=… npm run apk:release` → ends with
      `apk-verify: ok` and the SHA-256.
- [ ] Publish the APK (e.g. a GitHub Release asset), fill the `apk` entry of
      `public/version.json`, redeploy the web; `/download` shows it.

## 6. Keep it running

- [ ] GitHub → Settings → Secrets and variables → Actions: `SUPABASE_URL`
      and `SUPABASE_ANON_KEY` so `keepalive.yml` keeps the free project awake.
- [ ] Run the manual QA in [qa-checklist.md](qa-checklist.md) on a real
      phone with the APK and with the browser.
- [ ] Keep [runbook.md](runbook.md) at hand.
