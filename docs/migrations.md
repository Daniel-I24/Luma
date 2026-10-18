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
| 5 | `20261017000000_orders.sql` | `orders` (with business name/address copies), `order_items`, `app_settings` | Pending review |
| 6 | `20261017000100_order_functions.sql` | `create_order` | Pending review |
| 7 | `20261017000200_order_status_functions.sql` | `cancel_order`, `set_order_status` | Pending review |
| 8 | `20261018000000_business_panel.sql` | `prep_minutes`, CHECKs (NOT VALID), owner reads of hours/promotions, hours upsert, publish guard | Pending review |
| 9 | `20261018000100_business_images.sql` | `business-images` bucket, Storage policies, https-only image URLs | Pending review |
| 10 | `20261018000200_business_orders.sql` | Owner views `business_orders`, `business_order_items` | Pending review |
| 11 | `20261018000300_notifications.sql` | `notifications`, RLS, triggers on `orders` | Pending review |

"Applied" is what the project documentation recorded before this batch
(the orders migrations were the first ones marked as not applied); nothing
in this repository can confirm the state of the live project. Before
applying, compare with the project's migration history
(`supabase migration list` or `supabase_migrations.schema_migrations`).

Every pending migration ends with `notify pgrst, 'reload schema';`, grants
explicitly, revokes `EXECUTE` on its functions from `public` and `anon`, and
keeps SQL comments in ASCII.

## After applying 8 and 9: validate the NOT VALID constraints

The CHECK constraints added to existing tables are `NOT VALID`: new and
updated rows are checked, old rows are not. Find rows that would fail:

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

Fix them, then validate:

```sql
alter table public.businesses
  validate constraint businesses_name_length,
  validate constraint businesses_category_valid;
-- one "alter table ... validate constraint <name>;" per constraint:
-- businesses_description_length, businesses_address_length,
-- businesses_phone_format, businesses_location_range,
-- businesses_logo_url_https, businesses_cover_url_https,
-- business_hours_open_differs, promotions_title_length,
-- promotions_description_length, promotions_dates_order,
-- promotions_image_url_https
```

## Security tests

`supabase/tests/*.sql` (179 checks) run as the `anon` and `authenticated`
roles with a JWT `sub`, each file in a transaction that is rolled back.

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
