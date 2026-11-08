# Migrations

Apply the files in `supabase/migrations/` **in this exact order** (it is also
the filename order). Use a UTF-8 client: some files contain accented
category names (`Cafetería`), and the Supabase SQL editor and CLI are UTF-8.

| # | File | What it does | Status |
| --- | --- | --- | --- |
| 1 | `20240001000000_create_profiles.sql` | `profiles` + trigger from `auth.users` | Applied |
| 2 | `20240002000000_create_businesses.sql` | `businesses`, `business_hours`, `promotions`, RLS | Applied |
| 3 | `20261014000000_business_profile.sql` | `menu_items`, `favorites`, `reviews`, rating views | Applied |
| 4 | `20261015000000_grant_existing_tables.sql` | Explicit column grants for the tables above | Applied |
| 5 | `20261017000000_orders.sql` | `orders` (with business name/address copies), `order_items`, `app_settings` | Applied |
| 6 | `20261017000100_order_functions.sql` | `create_order` | Applied |
| 7 | `20261017000200_order_status_functions.sql` | `cancel_order`, `set_order_status` | Applied |
| 8 | `20261018000000_business_panel.sql` | `prep_minutes`, CHECKs (NOT VALID), owner reads of hours/promotions, hours upsert, publish guard | Applied |
| 9 | `20261018000100_business_images.sql` | `business-images` bucket, Storage policies, https-only image URLs | Applied |
| 10 | `20261018000200_business_orders.sql` | Owner views `business_orders`, `business_order_items` | Applied |
| 11 | `20261018000300_notifications.sql` | `notifications`, RLS, triggers on `orders` | Applied |
| 12 | `20261019000000_account_types.sql` | `account_type`, private `full_name`/`phone`, consent, onboarding version, `become_business_owner`, max 3 businesses | Applied |
| 13 | `20261020000000_business_verification.sql` | `verification_status`/`note`/`verified_at`, `admins`, `is_admin`, `am_i_admin`, NIT check digit | Applied |
| 14 | `20261020000100_public_visibility.sql` | `is_business_public` in every public policy and view | Applied |
| 15 | `20261020000110_create_order_public.sql` | `create_order` only for public businesses | Applied |
| 16 | `20261020000200_verification_access.sql` | `business_legal`, `business_verification_docs`, no client writes to `verification_*` | Applied |
| 17 | `20261020000300_verification_workflow.sql` | `submit_business_for_review`, `review_business`, re-review trigger, `reports` | Applied |
| 18 | `20261020000310_reports_admin.sql` | Admin list of open reports | Applied |
| 19 | `20261020000400_verification_storage.sql` | Private `verification-docs` bucket and its Storage policies | Applied |
| 20 | `20261021000000_promotion_discounts.sql` | Promotion discounts on one item (5-90 %, same business, max 5 active), list/final price and promotion on order lines, `create_order` prices with the best current discount | Applied |
| 21 | `20261022000000_ai_gateway.sql` | Luma IA: closed `ai_usage`/`ai_cache`, `consume_ai_quota`, cache functions (service_role only; 24 h, 7 days for `geocode:`), `ai_recommend_candidates`, `owner_sales_summary` | Applied |
| 22 | `20261023000000_order_safeguards.sql` | Hourly order caps, `expire_stale_orders` (pg_cron every 5 min when enabled) | Applied |
| 23 | `20261024000000_business_showcase.sql` | Contact columns (WhatsApp, Instagram, Facebook, web), `business_photos` (8), menu cap 200 | Applied |
| 24 | `20261025000000_menu_scan_quota.sql` | `consume_menu_scan_quota` (extract-menu, 5 a day per business) | Applied |
| 25 | `20261026000000_geocode_quota.sql` | `consume_geocode_quota` (200 a day per user, 5000 global) | Applied |
| 26 | `20261027000000_push_notifications.sql` | `device_tokens` + RPCs, notify preferences, `promotion` notifications, `notify_promotion` | Applied |
| 27 | `20261027000100_push_dispatch.sql` | `private.push_settings`, pg_net poke trigger, pg_cron fallback, `claim_push_batch`, `remove_device_tokens` | Applied |
| 28 | `20261028000000_export_my_data.sql` | `export_my_data` (habeas data, 3 a day) | Applied |

### Rounds 2 to 4 (29 to 51)

Status on 2026-10-28: **1 to 50 applied** in production after the owner's
review; 51 pending review at that date (current state in the tables).
Applied migrations are never edited again.
Many files, up to migration 56, still say "NOT APPLIED YET" in their header:
that line records the moment they were written, and it stays because applied
files are not edited. The table here is the state to read. Each round adds new files only,
later than the last applied one; a changed function is redefined with
`create or replace` keeping its arguments and grants (a changed return type
needs a drop and a create in the same file, noted in the file header).

| # | File | What it does | Status |
| --- | --- | --- | --- |
| 29 | `20261029000000_push_business_id.sql` | `claim_push_batch` also returns `business_id` (drop + create: new return column; same arguments and grants) | Applied |
| 30 | `20261029000100_round1_hardening.sql` | `notify_promotion` capped at `promotion_notify_max_recipients` (500); `handle_new_user` compares jsonb instead of casting; `register_device_token` needs a confirmed email | Applied |
| 31 | `20261029000200_rate_limits.sql` | Closed `rate_limit_hits`, `hit_rate_limit(bucket)` with buckets defined in `app_settings` (`menu_scan`: 6 per 10 minutes) | Applied |
| 32 | `20261030000000_admin_mfa_audit.sql` | `is_admin()` needs aal2 (TOTP); `admin_access()`; append-only `admin_audit_log`, `log_admin_action`, `admin_recent_audit` | Applied |
| 33 | `20261030000010_review_business_audit.sql` | `review_business` unchanged, plus one audit row per decision | Applied |
| 34 | `20261030000100_customer_profile.sql` | Residence (department, municipality, DANE code, neighbourhood), avatar columns, `is_profile_complete`, `is_phone_verified`, `phone_check_passed` (`require_phone_verification` 0), `become_business_owner` needs a complete profile | Applied |
| 35 | `20261030000110_avatars.sql` | Private `avatars` bucket (2 MB, one per user), Storage policies, `can_view_customer_avatar`, `set_avatar` with consent | Applied |
| 36 | `20261030000200_trust_tiers.sql` | `cancel_reason`, `ready_at`, `cancelled_at`; `set_order_status(order, status, reason)` (2-argument version dropped); `customer_strikes` | Applied |
| 37 | `20261030000210_trust_status.sql` | `customer_trust_tier`, `my_trust_status`, `admin_strikes`, `admin_clear_strikes` | Applied |
| 38 | `20261030000300_payments_schema.sql` | `orders.payment_method` 'online', status 'awaiting_payment', `payment_status`; closed `payments` with an immutability trigger; payment settings (off by default) | Applied |
| 39 | `20261030000310_payment_events.sql` | `payment_transition_allowed` (state machine), status guard, append-only `payment_events` | Applied |
| 40 | `20261030000320_prepare_payment.sql` | `payment_config`, `prepare_payment` (3 attempts), `my_order_payment`, `record_payment_redirect` | Applied |
| 41 | `20261030000330_apply_payment_event.sql` | `mark_refund_required`, `apply_payment_event` (service_role, idempotent), `payments_to_reconcile` | Applied |
| 42 | `20261030000340_payment_admin.sql` | Paid and cancelled orders become refund_required; `cancel_order` also while awaiting payment; `admin_payment_issues`, `admin_request_void`, `admin_mark_refund_done` | Applied |
| 43 | `20261030000400_business_operations.sql` | `orders_paused_until`, `set_orders_paused`, `business_paused`; owner-chosen `department` and `city_dane_code` | Applied |
| 44 | `20261030000500_create_order_final.sql` | The single final `create_order` (5 arguments, 4-argument version dropped) with every protection | Applied |
| 45 | `20261030000510_order_lifecycle.sql` | Notifications for paid orders and review invitations, `business_orders` without unpaid orders (payment, reason, avatar columns), `expire_stale_orders` also for unpaid online orders | Applied |
| 46 | `20261030000600_business_signals.sql` | `pg_trgm`, `digits_only`, `phone_keys`, `tax_id_taken`, `business_review_flags` | Applied |
| 47 | `20261030000610_submit_tax_id.sql` | `submit_business_for_review` refuses `tax_id_in_use` | Applied |
| 48 | `20261030000620_owner_sales_daily.sql` | `owner_sales_daily(business, 7 or 30)` | Applied |
| 49 | `20261030000700_payment_service.sql` | `payment_event_seen`, `payment_attempt`, `admin_note_reconcile`, `private.payments_cron` and the reconciliation cron (only when pg_cron exists) | Applied |
| 50 | `20261031000000_phone_verification.sql` | Round 3: `submit_business_for_review` also checks `phone_check_passed`; `profiles_phone_guard` (phone changes only to the confirmed number while required); `verified_auth_phone`, `sync_verified_phone` | Applied |
| 51 | `20261101000000_round4_hardening.sql` | Round 4: one payment attempt at a time (`attempt_in_progress`), duplicate charge → `refund_required` (`private.flag_payment_refund`, `duplicate_charge` / `refund_pending_admin`), lock order then payment, reconcile attempts without id, void only for refunds, `payments` closed to service_role, `business_order_items` without unpaid orders, NIT blocks only against approved businesses (also on approval), trigger functions not executable by anon | Applied |
| 52 | `20261102000000_round5.sql` | Round 5: `create_order` refuses `own_business`; contact verification (`contact_verifications`, `<kind>_verified_at`, `request_contact_verification`, `admin_pending_contact_verifications`, `admin_verify_contact`, audit `verify_contact`); `business_trust_summary`; `request_legal_correction`; notification types `contact_verification` and `test`, `send_test_notification`; rate limits `push_test` and `route` | Applied |
| 53 | `20261103000000_round6.sql` | Round 6: `contact_verifier_config` (strategy per kind, flags off), `verify_contact_from_whatsapp` (service_role; ids and sender hash in `private`), `start_website_check` / `complete_website_check`, `private.mark_contact_verified`; depends on 52 | Applied |
| 54 | `20261104000000_round7.sql` | Round 7: daily limit of business creations (`business_create`); validation functions in `private` and CHECK constraints NOT VALID (docs/validation-matrix.md, docs/data-quality.sql); discount 1-90; `handle_new_user` cleans the name; order notes cleaned; phones compared in +57; `contact_verifications` without `verified_by` for owners; request limit per kind | Applied |
| 55 | `20261105000000_round8.sql` | Round 8: `send_test_notification` for admins only; `show_pending_businesses` (0) in `is_business_public`; `orders_online_needs_approval` (pick-up only while in review) | Applied |
| 56 | `20261106000000_round9.sql` | Round 9: `review_business` publishes on approval from review when there is an open day and an available product (`private.meets_publish_requirements`); `rate_business_create_max` 3 → 10 (internal guard); Realtime event tables `catalog_events` and `order_events` (ids only, triggers, RLS, pruning) and `supabase_realtime` with exactly those two (docs/realtime.md) | Applied (the owner's statement; nothing in this repository confirms it) |
| 57 | `20261107000000_round10.sql` | Round 10: optional `businesses.neighborhood` and `address_reference` (text rules, column grants; docs/location.md); `order_pickup_point(order_id)` SECURITY DEFINER, for the order's customer while accepted, preparing or ready, even if the business is hidden; `order_events` split by audience (customer row with `user_id` only, owner row with `business_id` only, CHECK `order_events_one_audience`, new read policy); the 20 oldest RLS policies use `(select auth.uid())` (same conditions, evaluated once per query) | Pending review |

| 58 | `20261108000000_push_claim_window.sql` | `claim_push_batch` leaves notices of users without a token waiting (`push_claim_window_minutes`, 60: older ones are marked and never sent); same arguments and grants | Pending review |
| 59 | `20261109000000_push_test_answer.sql` | `send_test_notification` answers whether the account has a device token (return type changes); `admin_push_health()` for the admin panel | Pending; the owner applies it |
| 60 | `20261110000000_cancellation_rules.sql` | `cancel_order` until the kitchen starts (`too_late_to_cancel` from `preparing`); `cancel_reason` adds `customer` and `payment_expired`; `payments_to_void()` | Pending; the owner applies it |
| 61 | `20261111000000_readable_export.sql` | `export_my_data` by name, without internal ids; 10 a day | Applied |
| 62 | `20261112000000_push_retry.sql` | `private.push_retries`, `schedule_push_retry`, `claim_push_retries`: a failed phone is tried again after 1, 5 and 15 minutes, only that phone | Pending; the owner applies it |
| 63 | `20261113000000_push_server_status.sql` | `private.push_requests`; `admin_push_health` reads only the answers of `push-dispatch`, with time and network error | Pending; the owner applies it |
| 64 | `20261114000000_cron_jobs.sql` | Schedules `luma-expire-stale-orders` and `luma-reconcile-payments`, missing in production; the job also wakes for card refunds to void. Orders past their expiry are cancelled by the first run | Pending; the owner applies it |
| 65 | `20261115000000_abandoned_payments.sql` | Payment status `expired`; `expire_abandoned_payments()` closes attempts that never reached Wompi, run by `luma-expire-stale-orders`; `expired -> approved` for a late approval | Pending; the owner applies it |
| 66 | `20261116000000_foreign_key_indexes.sql` | Indexes for the seven foreign keys without one (notifications, order_items, rate_limit_hits, reports); deleting a parent no longer reads the whole child table | Pending; the owner applies it |

**Database freeze (2026-10-19)**: the list above is final for the launch.
After the freeze, migrations and functions change only to fix real bugs
(each noted in docs/WORKLOG.md). Open idea: `profiles.language`, so push texts follow
the user's language (Spanish only today).

Earlier rows were edited in place while still unapplied (separate consents,
email confirmation checks, frozen identity while pending, stale reviews,
cancellations after accepting, gallery folder and 80-file cap).

### Before applying: extensions and secrets

- Authentication > Multi-Factor: **TOTP enabled before migration 32**:
  from then on `is_admin()` needs an aal2 session, so an admin without a
  TOTP factor cannot review until they enrol at `/admin/mfa`.
- Database > Extensions: `pg_trgm` (required by migration 46; it creates it
  in the `extensions` schema if it is allowed, otherwise enable it first).
- Database > Extensions: `pg_cron` and `pg_net` (optional; without them
  stale orders are not expired automatically and push needs the cron/poke).
- Auth > Email: "Confirm email" on, OTP template with `{{ .Token }}` (see
  docs/launch-checklist.md). Users who never confirmed their email can read
  but cannot write until they confirm.

Checked on 2026-10-19 on Postgres 17 with the local stubs:

- clean install: every file in order on an empty database, then every SQL
  suite (`supabase/tests/local/run.sh`);
- production-like rehearsal (`supabase/tests/local/rehearsal.sh`): only the
  four applied migrations, legacy data with dirty rows
  (`legacy_seed.sql`), then every pending migration, checks of the old rows
  (`rehearsal_checks.sql`) and the VALIDATE report. It caught a real bug
  (fixed): an UPDATE of legacy rows would have been rejected by the NOT
  VALID checks of earlier migrations.

"Applied" is what the project documentation recorded before this batch
(the orders migrations were the first ones marked as not applied); nothing
in this repository can confirm the state of the live project. Before
applying, compare with the project's migration history
(`supabase migration list --remote` or `supabase_migrations.schema_migrations`).
The CLI targets the local database unless it gets `--remote`. A migration pasted
in the SQL editor is not recorded in that history: `db push` would try it again
unless it is recorded with `supabase migration repair --remote --status applied <version>`.
On 2026-11-06 the history listed 1 to 56, and `db push --remote --dry-run` only 57 and 58.

Every pending migration ends with `notify pgrst, 'reload schema';`, grants
explicitly, revokes `EXECUTE` on its functions from `public` and `anon`, and
keeps SQL comments in ASCII.

## File length

The code limits do not fit old migrations: 14 SQL files are over 150 lines and
three over 300 (`round4_hardening`, `round5`, `round7`). They are not split,
because an applied migration is never edited. New migrations aim at 150 lines
and stay under 300 (.kiro/steering/conventions.md).

## After applying everything: validate the NOT VALID constraints

The CHECK constraints added to existing tables are `NOT VALID`: new and
updated rows are checked, old rows are not (an owner editing an old dirty
row must fix it first). Run `supabase/sql/validate-report.sql` in the SQL
editor: it lists every unvalidated constraint with its failing row count.
To see the rows themselves:

```sql
select id, name, category, phone, address from public.businesses
where char_length(btrim(name)) not between 2 and 80
   or category not in ('Restaurante', 'Cafetería', 'Panadería', 'Pastelería', 'Heladería',
                       'Pizzería', 'Hamburguesería', 'Comida rápida', 'Bar', 'Tienda')
   or (phone is not null and phone !~ '^\+?[0-9][0-9 ]{6,19}$')
   or char_length(btrim(address)) not between 5 and 200
   or (logo_url is not null and logo_url !~* '^https://')
   or (cover_url is not null and cover_url !~* '^https://');
select id, title from public.promotions
where char_length(btrim(title)) not between 3 and 80 or ends_at <= starts_at
   or (image_url is not null and image_url !~* '^https://');
select id from public.business_hours where not is_closed and opens_at = closes_at;
```

Round 7 adds its own list of rows and VALIDATE statements: `docs/data-quality.sql`.

Fix them, then validate:

```sql
alter table public.businesses validate constraint businesses_name_length;
alter table public.businesses validate constraint businesses_category_valid;
alter table public.businesses validate constraint businesses_description_length;
alter table public.businesses validate constraint businesses_address_length;
alter table public.businesses validate constraint businesses_phone_format;
alter table public.businesses validate constraint businesses_location_range;
alter table public.businesses validate constraint businesses_logo_url_https;
alter table public.businesses validate constraint businesses_cover_url_https;
alter table public.business_hours validate constraint business_hours_open_differs;
alter table public.promotions validate constraint promotions_title_length;
alter table public.promotions validate constraint promotions_description_length;
alter table public.promotions validate constraint promotions_dates_order;
alter table public.promotions validate constraint promotions_image_url_https;
```

## Security tests

`supabase/tests/*.sql` (620 checks) run as the `anon` and `authenticated`
roles with a JWT `sub` (customers, owners and admins), each file in a
transaction that is rolled back.

- With Docker only: `docker run -d --name luma-pg -e POSTGRES_HOST_AUTH_METHOD=trust -v "$PWD":/repo:ro postgres:17`,
  then `docker exec -w /repo -e PGUSER=postgres luma-pg bash supabase/tests/local/run.sh`
  and `docker rm -f luma-pg` when done.

- On a Supabase database (local stack or a branch) with every migration
  applied: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/<file>.sql`.
- On a plain local Postgres (no Supabase CLI):
  `PSQL=psql PGPORT=5432 PGUSER=postgres supabase/tests/local/run.sh` creates
  a throwaway `luma_test` database, loads the minimal stubs in
  `supabase/tests/local/` (API roles, `auth.uid()`, `storage` schema), applies
  every migration and runs every suite. It passes the shared cases file to
  `opening_hours_cases.sql` as the psql variable `cases`; on a Supabase
  database add `-v cases="$(cat supabase/tests/fixtures/opening_hours_cases.json)"`.

| File | Covers |
| --- | --- |
| `orders_security.sql` | privileges, server-side totals, `create_order` validation |
| `orders_status.sql` | visibility, cancelling, owner transitions, pending limit |
| `orders_retention.sql` | business copies, deleted business, deleted account (anonymised) |
| `orders_hours.sql` | `create_order` against the opening hours, "Ahora" and scheduled |
| `opening_hours_cases.sql` | `business_open_at` with the cases shared with the app |
| `harness_identity.sql` | the helpers restore role and JWT after every check |
| `business_panel_security.sql` | registering, constraints, editing others, publishing guard |
| `business_panel_content.sql` | hours (upsert, other businesses), menu, promotions |
| `business_images_security.sql` | bucket limits, Storage paths, other owners/buckets, https URLs |
| `business_orders_security.sql` | owner views: isolation, no `user_id`/email, read only |
| `notifications_security.sql` | triggers (incl. cancellation to the owner), own rows only, `read_at` only, no client inserts |
| `account_types_security.sql` | account type from metadata, private columns, `become_business_owner`, business limit |
| `verification_visibility.sql` | only active and approved businesses are public (tables, views, Storage, `create_order`) |
| `ai_gateway.sql` | closed AI tables, daily quotas (user, business, global), service_role-only cache, public/open candidates, owner-only sales aggregates without customer ids |
| `promotion_discounts.sql` | discount rules, item of the same business, 5 active max, visibility, best discount and rounding in `create_order`, client prices ignored |
| `verification_workflow.sql` | submit and review RPCs, admin-only actions, re-review trigger, reports, private legal data and documents |
| `verification_review.sql` | frozen identity while pending, `stale_review`, transitions and reactivation |
| `email_and_order_safeguards.sql` | confirmed email on every write, hourly caps, owner cancellations, `expire_stale_orders` |
| `business_showcase.sql` | contact formats, gallery (8, owner only), 80 files per folder, menu cap |
| `menu_scan_quota.sql` / `geocode_quota.sql` | quotas, owners only, refused calls not counted, cache TTL |
| `push_notifications.sql` | tokens, preferences, `notify_promotion` rules, claim at most once, pg_net poke |
| `export_my_data.sql` | own data only, no tokens, no customer data for owners, daily limit |
| `policy_helpers.sql` | direct checks of the helpers used by policies |
| `round1_hardening.sql` | sign-up metadata never raises, devices need a confirmed email, promotion recipient cap, business id in push claims, microsecond `updated_at` in `review_business` |
| `rate_limits.sql` | `hit_rate_limit`: unknown buckets, own bucket per user, window reset, closed table |
| `admin_mfa_audit.sql` | admins without aal2 are not admins, `admin_access`, append-only audit log, logged decisions |
| `customer_profile.sql` | residence rules, completeness, phone check, private avatars and the business access rule |
| `trust_tiers.sql` | cancel reasons, no-show timing, strikes, tiers, restriction end, admin clear |
| `create_order_final.sql` | one check per `create_order` protection, pause, trust tiers, online orders, exactly one definition |
| `payments_flow.sql` | state machine vectors, `prepare_payment`, `apply_payment_event` (mismatch, duplicates, retries, late events), reconcile list |
| `payments_admin.sql` | immutable attempts, append-only events, expiry, refunds, admin tools with aal1 and aal2, review invitation |
| `business_signals.sql` | `tax_id_in_use`, review flags, daily sales |
| `payments_round4.sql` | `attempt_in_progress` and its hint, two approved attempts (duplicate charge, paid once), refund notifications, void and refund rules, reconcile without id, `payments` closed to service_role, `business_order_items` |
| `review_tax_id.sql` | NIT with two owners: pending is a flag, approval refused with `tax_id_in_use` |
| `function_privileges.sql` | anon executes only `is_business_public(uuid)` (plus a commented allow-list); `set_updated_at` triggers still run |
| `payment_service.sql` | service RPCs of the payment functions (service_role only), `admin_note_reconcile` with aal2 and logged, private cron settings |
| `phone_verification.sql` | off by default nothing changes; with `require_phone_verification` the order, owner and review RPCs refuse `phone_not_verified`; phone synced from auth |
| `round5.sql` | `own_business`, verifiable contacts, public trust summary, legal data correction, test push |
| `round6.sql` | automatic contact verification: WhatsApp inbound, website file, strategy per kind, Instagram/Facebook in the admin queue |
| `round7.sql` | businesses per owner, validation vectors shared with the app, CHECK constraints |
| `round8.sql` | migration 55: test notification for admins only, `show_pending_businesses` visibility, pick-up only while in review |
| `round9.sql` | migration 56: approval publishes when ready, approved but hidden without a product, owner pause kept after a re-approval, `show_pending_businesses` states through the API roles, guard of 10 creations a day |
| `round10.sql` | migration 57: sector and reference rules, `order_pickup_point` with three users (customer, another customer, another owner, and the business owner), paused business still reachable, order events without the customer id for the owner |
| `cron_jobs.sql` | migration 64: the reconcile job stays quiet with no work, and no client role reaches its check |
| `push_retry.sql` | migrations 62 and 63: only the failed phone, 3 more tries, removed phone, refused consent and old notices are not tried, and the payments cron answer is not shown as the push server |
| `push_claim_window.sql` | migration 58: a notice waits for a token, goes out once, older than the window is never sent, refused consent is not kept |
| `realtime_events.sql` | migration 56: catalog events of public businesses only, order events for the customer and the owner (three users), no client writes, pruning, publication |

`scripts/db-drift.test.mjs` (`npm run test:scripts`) checks without a
database: Storage folders vs delete-account, functions in config.toml, and
REVOKE/search_path/reload/ASCII rules plus a SQL test for every exposed
function in each pending migration.

Files starting with `_` (`_helpers.sql` and the `_*_fixtures.sql`) are
shared fixtures loaded by the suites, not suites. Round 8 phase 4 changed
no SQL: migration 55 is still the only pending one. Round 9 adds 56; round 10 adds 57 (56 must be applied first: 57 replaces its order event trigger and policy).
