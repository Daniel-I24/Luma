# Orders

Pick-up orders: the customer confirms the cart at `/checkout`, follows the
order at `/orders/:id` and can cancel it while it is pending. **The
migrations are not applied to any Supabase project yet** — review them first.

## Database

Migrations (apply in this order, after the existing ones):

1. `20261017000000_orders.sql` — `orders`, `order_items`, `app_settings`,
   RLS and grants.
2. `20261017000100_order_functions.sql` — `create_order`.
3. `20261017000200_order_status_functions.sql` — `cancel_order`,
   `set_order_status`.

| Rule | Where |
| --- | --- |
| Clients have no INSERT/UPDATE/DELETE on `orders` / `order_items` | grants |
| A customer reads only their orders and lines | RLS (`user_id = auth.uid()`) |
| Business owners do not read orders yet (future safe view without `user_id`/email) | no policy |
| Total = Σ `menu_items.price_cop` × quantity; client prices ignored | `create_order` |
| Active business; 1–20 distinct lines; quantities 1–20; items of that business and available | `create_order` |
| `pickup_at` NULL (as soon as possible) or 10 min – 7 days ahead | `create_order` |
| Notes ≤ 200 characters; payment `pay_at_pickup` only | `create_order` + checks |
| At most 5 pending orders per user (advisory lock per user) | `create_order` |
| Total cap (default 500 000 COP) | `app_settings.order_max_total_cop` |
| Customer cancels only their own order, only while `pending` | `cancel_order` |
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

## Security tests

`supabase/tests/orders_security.sql` and `orders_status.sql` (48 checks) run
as the `anon` and `authenticated` roles with a JWT `sub`, inside a transaction
that is rolled back:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/orders_security.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/orders_status.sql
```

They cover: anon cannot call the functions nor read the tables; clients
cannot insert, update or delete directly (total, status); a price sent by the
client is ignored; items of another business or unavailable are rejected;
line shape, pick-up window, notes and total cap; users cannot see or cancel
someone else's orders; owners cannot read orders; cancel only while pending;
valid and invalid owner transitions; the pending limit.

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

- The server does **not** check opening hours yet: an order can be placed for
  a time when the business is closed.
- Payment is **at pick-up only**; online payment with Wompi (hosted checkout,
  signed webhook, idempotency) is a later phase.
- The ready time shown for "as soon as possible" orders is a client estimate
  (created + 20 min, `docs/mocks.md`); there is no preparation time per
  business yet.
- Businesses have no screen to manage orders yet (`set_order_status` exists
  for the business panel phase).
- No notifications: the customer sees changes by polling the detail screen.
