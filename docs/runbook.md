# Runbook

What to do when something breaks in production. Diagnose with the anon key
first (`npm run verify:backend`), then the Supabase Dashboard (Logs →
Postgres / Edge Functions / Auth). Never paste the service role key or user
data into tickets or chats.

| Symptom | Likely cause | Check | Fix |
| --- | --- | --- | --- |
| "No pudimos cargar tu cuenta" for everyone | `profiles` columns missing (migration not applied) or Supabase down | `verify:backend` (table profiles) ; status.supabase.com | Apply the missing migration; users tap Reintentar |
| Sign-up email has a link / no email arrives | Template still has `{{ .ConfirmationURL }}`; built-in sender | Auth → Emails → Templates, SMTP | [auth-emails.md](auth-emails.md); own SMTP |
| "Debes confirmar tu correo" for a confirmed user | email not confirmed in `auth.users` | Auth → Users → user → Email confirmed | Resend the code from the login screen |
| Every write fails with `email_not_confirmed` | legacy users who never confirmed | same | They confirm with the code ("Verificar mi correo") |
| Place search says "no disponible" | `GEOCODE_PROVIDER` unset or provider down | Edge Functions → geocode logs (status 503) | Set/switch provider ([geocode.md](geocode.md)); businesses still filter |
| Place search "límite de hoy" | `geocode_daily_per_user` / `geocode_daily_global` reached | `select * from ai_usage where day = current_date and scope like 'geocode%'` | Raise in `app_settings` if the provider plan allows |
| Luma IA answers rules only | LLM secrets missing, provider failing, quota | function logs; `ai_usage` | Fix secrets ([ai.md](ai.md)); lower/raise quotas |
| Menu scan "no pudo leer" | vision model missing or 30 s timeout | extract-menu logs | Set `LLM_VISION_MODEL` to a model that reads images |
| No push notifications | `PUSH_ENABLED` false, missing google-services.json, push_settings, pg_net | `select count(*) from notifications where pushed_at is null and created_at > now() - interval '1 hour'` | [push.md](push.md); in-app list keeps working |
| Pending orders never expire | pg_cron disabled | `select * from cron.job` | Enable pg_cron and re-run the cron block of 20261023000000 |
| Too many orders refused (`too_many_orders`) | hourly caps | `app_settings` order_max_per_hour_* | Raise the caps if legitimate |
| Uploads fail | 80 files per business or 2 MB limit | Storage → business-images → folder | Owner deletes old pictures |
| Free project paused | no activity for a week | Dashboard banner | Restore; set the keepalive secrets |
| The APK shows "versión nueva" forever | `version.json` latest > APK version | `/version.json` | Publish the new APK or correct the file |

## Rollback

- Web: Vercel → Deployments → previous deployment → Promote.
- Database: migrations are forward-only. Restore the backup taken in
  [launch-checklist.md](launch-checklist.md) step 0 into a new project if a
  migration damaged data; otherwise fix forward with a new migration.
- Edge Function: redeploy the previous commit's folder
  (`git checkout <commit> -- supabase/functions/<name>` in a scratch clone,
  then `supabase functions deploy <name>`).
- Secrets: `supabase secrets unset <NAME>` disables an optional feature; the
  app falls back automatically.

## Contacts and access

Keep, outside the repository: who has Supabase owner access, the Vercel
account, the keystore and its passwords (two copies, offline), the Firebase
project and the SMTP provider.
