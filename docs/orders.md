# Orders

Pick-up orders: the customer confirms the cart at `/checkout`, follows the
order at `/orders/:id` and can cancel it while it is pending. **The
migrations are not applied to any Supabase project yet** — review them first.

## Database

Migrations (apply in this order, after the existing ones):

1. `20261017000000_orders.sql` — `orders` (with `business_name` and
   `business_address` copied at purchase), `order_items`, `app_settings`,
   RLS and grants.
2. `20261017000100_order_functions.sql` — `create_order`.
3. `20261017000200_order_status_functions.sql` — `cancel_order`,
   `set_order_status`.

Later migrations redefine `create_order`: only public businesses
(`20261020000110_create_order_public.sql`) and promotion discounts
(`20261021000000_promotion_discounts.sql`).

| Rule | Where |
| --- | --- |
| Clients have no INSERT/UPDATE/DELETE on `orders` / `order_items` | grants |
| A customer reads only their orders and lines | RLS (`user_id = auth.uid()`) |
| Business owners read orders only through `business_orders` / `business_order_items` (their businesses, no `user_id` or email; `customer_label` = public display name or NULL) | views, `security_barrier`, SELECT for authenticated |
| Unit price = menu price minus the best current discount of that item (`round(list × (100 − %) / 100)`, nearest peso, halves up); total = Σ unit price × quantity; client prices ignored | `create_order` → `order_line_prices` |
| Each line keeps `list_price_cop`, the final `unit_price_cop` and `promotion_id` | `order_items` |
| Public business (published and approved); 1–20 distinct lines; quantities 1–20; items of that business and available | `create_order` |
| `pickup_at` NULL (as soon as possible) or 10 min – 7 days ahead | `create_order` |
| Notes ≤ 200 characters; payment `pay_at_pickup` only | `create_order` + checks |
| At most 5 pending orders per user (advisory lock per user) | `create_order` |
| Total cap (default 500 000 COP) | `app_settings.order_max_total_cop` |
| Customer cancels only their own order, only while `pending` | `cancel_order` |
| Business name and address are copied into the order; deleting the business sets `business_id` to NULL and keeps the order | `orders` FK `on delete set null` + `create_order` |
| Owner transitions: pending→accepted/cancelled, accepted→preparing, preparing→ready, ready→picked_up | `set_order_status` |

The functions are `SECURITY DEFINER` with `search_path = ''`, executable only
by `authenticated` (revoked from `public` and `anon`). Errors are raised with
a code as message (`too_many_pending`, `item_unavailable`, …) that the app
maps to translated texts (`shared/orders/order-error.ts`).

Limits live in `public.app_settings` (no client access):

```sql
update public.app_settings set int_value = 300000 where key = 'order_max_total_cop';
update public.app_settings set int_value = 3      where key = 'order_max_pending_per_user';
```

## Retention

- `orders.business_id` is `on delete set null`: deleting a business keeps
  its customers' orders and lines, with the copied `business_name` and
  `business_address`. The app shows the name with "Negocio no disponible"
  and no directions.
- **Anonymised, not deleted:** `orders.user_id` is `on delete set null`.
  Deleting an account keeps its orders and lines for the business's history;
  the trigger `orders_anonymise_notes` clears `notes` (the only text the
  customer wrote) as soon as `user_id` becomes NULL. The owner keeps seeing
  them in `business_orders` with `customer_label` NULL ("Cliente"); no
  customer can read them any more.
- **Before charging real payments**, review the legal retention of sales
  records (accounting and tax rules) with a lawyer: amounts, dates and lines
  are kept; nothing identifies the customer.

## Opening hours on the server

`create_order` rejects with `business_closed` when the business is closed at
`now()` ("Ahora") or at the requested pick-up time. It uses
`public.business_open_at(business, at)`, which implements the app's single
rule (`shared/business/domain/opening-hours.ts`):

- a row of day D is open on D from `opens_at` until `closes_at`; when
  `closes_at < opens_at` it crosses midnight and ends at `closes_at` of D+1;
- only that crossing makes D+1's early morning open — today's row never opens
  today's early morning;
- a closed day neither opens nor carries an early morning to the next day;
- `opens_at = closes_at` is invalid (CHECK `business_hours_open_differs` and
  the panel's validation);
- the closing minute is already closed; the opening minute is open.

The time zone is defined once, in `public.app_local_time()`
(America/Bogota). The app evaluates the same rule on the device clock, which
is the same zone for users in Colombia. The cases in
`supabase/tests/fixtures/opening_hours_cases.json` are run by Vitest
(`OpeningHours`) and by `opening_hours_cases.sql`; map statuses ("abre
pronto", "cierra pronto") come from the same object.

## Security tests

`supabase/tests/orders_security.sql`, `orders_status.sql`,
`orders_retention.sql`, `orders_hours.sql`, `opening_hours_cases.sql` and
`promotion_discounts.sql` (discounts, rounding, expired or foreign
promotions) run
as the `anon` and `authenticated` roles with a JWT `sub`, inside a transaction
that is rolled back:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/orders_security.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/orders_status.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/orders_retention.sql
```

They cover: anon cannot call the functions nor read the tables; clients
cannot insert, update or delete directly (total, status); a price sent by the
client is ignored; items of another business or unavailable are rejected;
line shape, pick-up window, notes and total cap; users cannot see or cancel
someone else's orders; owners cannot read orders; cancel only while pending;
valid and invalid owner transitions; the pending limit; the business copies
survive a rename and a deletion (order kept, `business_id` NULL, still
private and cancellable by its customer); deleting the account deletes its
orders.

## Moving a test order by hand (SQL Editor)

The SQL Editor runs as `postgres`, so `auth.uid()` is null there. Either
impersonate the business owner inside a transaction:

```sql
begin;
select set_config('request.jwt.claim.sub', '<owner auth.users id>', true);
select public.set_order_status('<order id>', 'accepted');   -- then preparing, ready, picked_up
commit;
```

or, for test data only, update the row directly (bypasses the transition
rules — keep them in mind):

```sql
update public.orders set status = 'preparing' where id = '<order id>';
```

Find orders with
`select id, status, created_at from public.orders order by created_at desc;`.
The app's detail screen polls every 15 s while visible, so changes show up
without reloading.

## Limitations

- Opening hours: at `/checkout`, "Ahora" is disabled while the business is
  closed and "Más tarde" / "Mañana" offer only 15-minute slots inside the
  hours; the server checks them again (see above).
- Payment is **at pick-up only** (`PAYMENT_GATEWAY` = `PayAtPickupGateway`);
  the Wompi plan is in [payments.md](payments.md).
- The ready time shown for "as soon as possible" orders is created_at +
  the business's `prep_minutes` (20 when unknown), and the travel time is
  a straight-line approximation shown only when the user's location is
  known (`docs/mocks.md`).
- Owners manage orders at `/owner/:id/orders` (tab Pedidos of Luma Negocios) (tabs Nuevos, En
  preparación, Listos, Historial; Aceptar, Rechazar, Preparando, Listo,
  Entregado through `set_order_status`; refresh every 15 s while visible).
  Migration `20261018000200_business_orders.sql`, tests
  `business_orders_security.sql`.
- In-app notifications (no push yet): owners are told about new orders and
  about cancellations by the customer, customers about status changes (`20261018000300_notifications.sql`,
  `/notifications`).
