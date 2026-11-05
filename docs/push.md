# Push notifications

Phone notifications reuse the in-app `notifications` rows: the database
creates them (orders, reviews, promotions) and `push-dispatch` sends them
to the user's devices through Firebase Cloud Messaging (HTTP v1). Without
Firebase configured, everything keeps working with the in-app list only.

## Data

| Object | Who | Notes |
| --- | --- | --- |
| `device_tokens` | RPCs only | `register_device_token(token, platform)` (confirmed email), `unregister_device_token(token)`; at most 10 per user; a token moves to the account that signs in last on that phone; deleted with the account (cascade) |
| `profiles.notify_orders` | the user | default on (orders and reviews are transactional) |
| `profiles.notify_promotions` | the user | default **off**: promotions are marketing and need explicit consent (Ley 1581) |
| `notify_promotion(promotion)` | owner of a public business | once per promotion, 1 per business per day, only while running; recipients: favourites with `notify_promotions`, at most `promotion_notify_max_recipients` (500, the most recent favourites first); returns the count |
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
3. `pg_cron` pokes it every minute while there is work: an unsent notice of a
   user with a token, or one older than `push_claim_window_minutes` (60) to mark
   (migration 58). A notice of a user without a token waits, and does not poke.
4. push-dispatch claims up to 5 x 100 rows (each one **at most once**),
   checks consent again, sends a Spanish title/body built on the server
   (only the public business name; never customer names or user text) and
   data `{ type, notification_id, order_id?, business_id? }`. Each send is
   isolated: a network or FCM error on one device counts as `failed` and
   the batch goes on.
5. A token is deleted only when FCM blames the token itself: HTTP 404,
   `UNREGISTERED`, or `INVALID_ARGUMENT` whose details point at
   `message.token` (or whose message says the registration token is not
   valid). Any other `INVALID_ARGUMENT` is a payload problem on our side and
   keeps the device.

## Android channels and taps

The app creates two channels when it registers (names translated, lock
screen shows only that a notice arrived): `orders` (high importance:
orders, payments, review invitations and business reviews) and
`promotions` (default importance). push-dispatch sets
`android.notification.channel_id` by type, so users can mute promotions in
Android settings without losing order updates.

A tapped notification opens (`PushRoute`): the order for `order_status`,
`payment` and `review_invite`; the owner panel orders for `order_new` and
`order_cancelled`; the owner summary for `business_review`; the business
for `promotion`; the notification list for anything else.

## Setup (manual, by the owner)

Step by step, with the test notification: docs/push-setup.md.

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
- SQL: `supabase/tests/round1_hardening.sql` (recipient cap, business_id in
  the claim, confirmed email for devices).
- Deno: `supabase/functions/push-dispatch` (RS256 assertion verified with a
  generated key, token reuse, dead-token rules, secret check, batches, one
  failing send never stops the rest, channels, texts).
- App: `push-route.spec.ts`, `push-registration.spec.ts`.

## Turning it on in the app

`src/app/core/push/push-platform.ts` (`PUSH_ENABLED`) is `false` by
default: without `google-services.json` the Android app would crash when
registering. After steps 1-5, set it to `true`, rebuild the APK
(`npm run apk:release`) and check on a phone: Profile > Notificaciones >
"Permitir notificaciones", place an order from another account, and the
phone shows "Nuevo pedido". On the web the settings only show the in-app
list (no web push).
