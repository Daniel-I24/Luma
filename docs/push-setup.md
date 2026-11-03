# Push notifications: step-by-step setup

What the code already does, end to end (docs/push.md has the design):
the app explains why it asks (Perfil → Notificaciones, "Permitir
notificaciones"), registers the device token (`register_device_token`),
every new notification row pokes `push-dispatch` through `pg_net`, the
function sends it with FCM, and tapping it opens the order (PushRoute: the
order for customers, the board for owners). The only missing pieces are the
owner's: the Firebase project, its files and secrets.

Nothing below is in the repository: `google-services.json` and the service
account are **gitignored and never committed**.

## 1. Firebase project

1. https://console.firebase.google.com → "Add project" (Analytics not needed).
2. "Add app" → Android. Package name: the `applicationId` of
   `android/app/build.gradle`.
3. Download `google-services.json` and put it in `android/app/`.

## 2. Service account (server side)

1. Firebase → Project settings → Service accounts → "Generate new private key".
2. Keep the JSON file outside the repository; you delete it at step 3.

## 3. Secrets and function

On Windows, option 2 of `scripts/luma.ps1` (or `scripts/setup-push.ps1`,
the same code) does this whole step and writes the SQL of step 4, printing
no secret. It uses `npx supabase` (no global install) and deploys with
`--use-api` (no Docker):

```powershell
# the service account in %USERPROFILE%\luma-secrets\firebase-service-account.json
powershell -ExecutionPolicy Bypass -File scripts\luma.ps1
# then paste %USERPROFILE%\luma-secrets\push-settings.sql in the SQL editor
```

Repeating it keeps the shared secret already in push-settings.sql, so the
SQL only has to be pasted once.

By hand:

```sh
openssl rand -hex 32            # the shared secret, used twice below
supabase secrets set FCM_SERVICE_ACCOUNT="$(tr -d '\n' < service-account.json)"
supabase secrets set PUSH_DISPATCH_SECRET=<the 64 hex characters>
supabase functions deploy push-dispatch --no-verify-jwt
```

Delete `service-account.json` afterwards.

## 4. Database: pg_net, pg_cron and push_settings

1. Supabase → Database → Extensions: enable `pg_net` and `pg_cron`.
2. The push migrations (`20261027000000`, `20261027000100`) are applied
   with the rest; if the extensions were enabled later, re-run the cron
   block of `20261027000100`.
3. SQL editor:

   ```sql
   insert into private.push_settings (function_url, secret)
   values ('https://<ref>.supabase.co/functions/v1/push-dispatch', '<the same secret>')
   on conflict (id) do update set function_url = excluded.function_url, secret = excluded.secret;
   ```

To rotate the secret: set the new one in the Edge secret first, then here.

## 5. The app

1. Put `google-services.json` in `android/app/`: the build turns push on
   by itself (`scripts/build-flags.mjs`; `PUSH_ENABLED=0` turns it off).
   `npm run apk:release` prints `PUSH_ENABLED: true`. Before round 8 the
   flag was a constant `false`, so no APK ever registered for push.
2. Install the APK (docs/release.md).
3. On the phone: Perfil → Notificaciones → "Permitir notificaciones".
4. As an admin (MFA): /admin → Operaciones → **"Probar mi dispositivo"**
   (migration 55: `send_test_notification` is for admins only, at most 3 a
   day). Customers and owners no longer have a test button. It appears in the in-app
   list and, within a minute at most, as a phone notification: "Notificación
   de prueba". The push goes to the orders channel and follows the
   "Pedidos" preference: with it off, only the in-app list shows it.
5. From another account place an order: the owner's phone shows "Nuevo
   pedido"; tapping it opens the order board.

## If nothing arrives

| Symptom | Check |
| --- | --- |
| In the list but no push | `push-dispatch` logs; `FCM_SERVICE_ACCOUNT` set; `private.push_settings` row and secret equal to `PUSH_DISPATCH_SECRET` |
| "Permitir" does nothing | `google-services.json` was in `android/app/` when the APK was built (`PUSH_ENABLED: true` in its output) |
| Nothing with the app closed | the notification channel exists once the app opened after "Permitir"; battery saver of the phone not blocking Luma; the FCM message carries `notification` + `android.priority: high` (push-dispatch does) |
| Test button says the limit | 3 a day per user (`rate_push_test_*` in `app_settings`) |
