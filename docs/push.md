# Push notifications

Phone notifications reuse the in-app `notifications` rows: the database
creates them (orders, reviews, promotions) and `push-dispatch` sends them
to the user's devices through Firebase Cloud Messaging (HTTP v1). Without
Firebase configured, everything keeps working with the in-app list only.

## Data

| Object | Who | Notes |
| --- | --- | --- |
| `device_tokens` | RPCs only | `register_device_token(token, platform)`, `unregister_device_token(token)`; at most 10 per user; a token moves to the account that signs in last on that phone; deleted with the account (cascade) |
| `profiles.notify_orders` | the user | default on (orders and reviews are transactional) |
| `profiles.notify_promotions` | the user | default **off**: promotions are marketing and need explicit consent (Ley 1581) |
| `notify_promotion(promotion)` | owner of a public business | once per promotion, 1 per business per day, only while running; recipients: favourites with `notify_promotions`; returns the count |
| `private.push_settings` | SQL editor only | push-dispatch URL and the shared secret |
| `claim_push_batch`, `remove_device_tokens` | service_role | used by push-dispatch |

Errors of `notify_promotion`: `not_business_owner`, `business_not_public`,
`promotion_not_running`, `already_notified`, `notify_limit`,
`email_not_confirmed`.

## Flow

1. A notification row is inserted (trigger or `notify_promotion`).
2. A statement trigger pokes push-dispatch with `pg_net` (`x-push-secret`).
   If pg_net or the settings are missing, nothing happens; a failed poke
   never blocks the insert.
3. `pg_cron` pokes it every minute while unsent rows of the last day exist.
4. push-dispatch claims up to 5 x 100 rows (each one **at most once**),
   checks consent again, sends a Spanish title/body built on the server
   (only the public business name; never customer names or user text) and
   data `{ type, notification_id, order_id? }`, and removes tokens FCM
   reports as `UNREGISTERED` or invalid.

## Setup (manual, by the owner)

1. Firebase console: create a project, add the Android app
   (`applicationId` of `android/app/build.gradle`), download
   `google-services.json` to `android/app/` (**gitignored, never commit it**).
2. Project settings > Service accounts > Generate new private key.
3. Secrets (the JSON in one line; generate the secret with
   `openssl rand -hex 32`):

   ```sh
   supabase secrets set FCM_SERVICE_ACCOUNT="$(cat service-account.json | tr -d '\n')"
   supabase secrets set PUSH_DISPATCH_SECRET=<64 hex characters>
   supabase functions deploy push-dispatch --no-verify-jwt
   ```

   Delete the downloaded service-account file afterwards.
4. Database > Extensions: enable `pg_net` and `pg_cron`, then apply
   `20261027000000` and `20261027000100` (or re-run the cron block of the
   latter if the extensions were enabled later).
5. SQL editor:

   ```sql
   insert into private.push_settings (function_url, secret)
   values ('https://<ref>.supabase.co/functions/v1/push-dispatch', '<same secret>')
   on conflict (id) do update set function_url = excluded.function_url, secret = excluded.secret;
   ```

To rotate the secret: set the new value in both places, Edge secret first.

## Tests

- SQL: `supabase/tests/push_notifications.sql` (tokens, preferences, every
  `notify_promotion` rule, claim at most once, poke with a stubbed pg_net).
- Deno: `supabase/functions/push-dispatch` (RS256 assertion verified with a
  generated key, token reuse, dead tokens, secret check, batches, texts).

## Turning it on in the app

`src/app/core/config/push-enabled.ts` (`PUSH_ENABLED`) is `false` by
default: without `google-services.json` the Android app would crash when
registering. After steps 1-5, set it to `true`, rebuild the APK
(`npm run apk:release`) and check on a phone: Profile > Notificaciones >
"Permitir notificaciones", place an order from another account, and the
phone shows "Nuevo pedido". On the web the settings only show the in-app
list (no web push).
