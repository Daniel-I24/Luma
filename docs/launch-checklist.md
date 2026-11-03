# Launch checklist (only what the owner does)

In order. Commands are for **PowerShell** in the repository folder
(`C:\dev\Luma`). Replace `<ref>`, `<anon key>` and `<dominio>` with your
values; never paste the service_role key anywhere in the app.

## Now

1. **Back up the database**: Supabase → Database → Backups (download the
   latest) or:
   ```powershell
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db dump -f "$HOME\luma-backup-$(Get-Date -Format yyyyMMdd).sql"
   ```
2. **Prerequisites** in the dashboard: Authentication → Multi-Factor →
   TOTP **on**; Database → Extensions → `pg_trgm` **on** (optional:
   `pg_cron`, `pg_net`).
3. **Check what is applied** (should list 1 to 50 as applied):
   ```powershell
   npx supabase migration list
   ```
4. **Apply migration 51** (`20261101000000_round4_hardening.sql`) after your
   review (docs/migrations.md):
   ```powershell
   npx supabase db push
   ```
5. **Validate the old constraints**: in the SQL editor run
   `supabase/sql/validate-report.sql`; fix the rows it reports (queries in
   docs/migrations.md, "After applying everything"), then run the
   `alter table … validate constraint …` statements listed there.
6. **Check the backend from your PC**:
   ```powershell
   $env:SUPABASE_URL = "https://<ref>.supabase.co"
   $env:SUPABASE_ANON_KEY = "<anon key>"
   $env:APP_ORIGIN = "https://<dominio>"
   npm run verify:backend
   # after step 9, also require the two free functions:
   npm run verify:backend -- --expect-deployed=delete-account,geocode
   ```
7. **Auth settings and e-mails** (docs/auth-emails.md): paste the three
   templates (Confirm signup, Reset password, Reauthentication); 6-digit
   codes, 600 s; password 8+ with letters and digits; secure password
   change on; AAL1 session limit on; **your own SMTP** (the built-in sender
   only reaches team addresses).
8. **Admin MFA**: sign in with your admin account, open `/admin/mfa` and
   enrol the authenticator app.
9. **Edge Functions that cost nothing** (account deletion and address
   search with Nominatim):
   ```powershell
   npx supabase secrets set ALLOWED_ORIGINS="https://<dominio>,https://localhost" GEOCODE_PROVIDER=nominatim GEOCODE_CONTACT="<tu correo>"
   npx supabase functions deploy delete-account
   npx supabase functions deploy geocode
   ```
10. **Web**: in Vercel set `SUPABASE_URL` and `SUPABASE_ANON_KEY`
    (Production and Preview) and redeploy (docs/deploy.md).
11. **Test APK** (docs/release.md, JDK 21):
    ```powershell
    $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"
    npm ci
    npm run apk:debug
    adb install -r android\app\build\outputs\apk\debug\app-debug.apk
    ```
12. **Try it on the phone**: sign up with the code, complete "Mis datos",
    register a business, menu, hours, send it to review, approve it in
    `/admin`, order and pick up; check the screens with real data in the
    four themes (docs/round2-status.md, "Screen review").
13. **Signed APK** with your keystore (never in the repository):
    ```powershell
    $env:LUMA_KEYSTORE_PATH = "C:\keys\luma-release.jks"
    $env:LUMA_KEYSTORE_PASSWORD = Read-Host "Keystore password"
    $env:LUMA_KEY_ALIAS = "luma"
    $env:LUMA_KEY_PASSWORD = Read-Host "Key password"
    npm run apk:release
    ```
    Publish it as in docs/release.md ("Publish the APK").

## Later (each has its own document; all are off by default)

- **Wompi (online payments)**: secrets, deploy the four payment functions
  and the cron, validate one real sandbox event with
  `npm run check:wompi-event`, then the sandbox list in
  docs/payments-checklist.md, and only then `payments_enabled = 1`.
- **Firebase (push)**: `google-services.json` in `android/app/`,
  `FCM_SERVICE_ACCOUNT` and `PUSH_DISPATCH_SECRET`, deploy `push-dispatch`,
  `PUSH_ENABLED = true` (docs/push.md).
- **IA (Luma IA remote)**: `LLM_*` secrets, deploy `recommend`,
  `suggest-promotions` and `extract-menu`, then `AI_MODE = 'remote'`
  (docs/ai.md). Until then the rules engine works without cost; the menu
  photo scan needs this step.
- **SMS (phone verification)**: demo with Supabase test numbers or a paid
  provider with a spending cap, Colombia only and CAPTCHA
  (docs/phone-verification.md).
- **History cleanup** before making the repository public
  (docs/security-findings.md).
