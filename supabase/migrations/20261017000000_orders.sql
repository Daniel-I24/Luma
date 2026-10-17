-- -----------------------------------------------------------------------------
-- Migration: orders
-- Pick-up orders and their lines. NOT APPLIED YET: review before running.
--
-- Security notes:
--   - Clients never write these tables: no INSERT/UPDATE/DELETE privileges.
--     Orders are created by public.create_order and change status through
--     public.cancel_order / public.set_order_status (next migration), which
--     recalculate every price on the server.
--   - A customer reads only their own orders and lines (RLS).
--   - Business owners do NOT read orders yet; the business panel will use a
--     safe view without user_id or email.
--   - Retention: business_name and business_address are copies taken at
--     purchase time and business_id is set to NULL if the business is
--     deleted, so the customer keeps the record. user_id stays ON DELETE
--     CASCADE (deleting the account deletes its orders); review the legal
--     retention of records before charging real payments (docs/orders.md).
-- -----------------------------------------------------------------------------

-- 1. Settings read by the order functions -----------------------------------
create table if not exists public.app_settings (
  key       text    not null,
  int_value integer not null,

  constraint app_settings_pkey primary key (key)
);

comment on table public.app_settings is 'Server-side limits; only SECURITY DEFINER functions read it.';

insert into public.app_settings (key, int_value) values
  ('order_max_total_cop', 500000),
  ('order_max_pending_per_user', 5)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;
-- No policies and no grants: invisible to anon and authenticated.

-- 2. orders -----------------------------------------------------------------
create table if not exists public.orders (
  id             uuid        not null default gen_random_uuid(),
  user_id        uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  business_id    uuid        references public.businesses (id) on delete set null,
  business_name    text      not null
    constraint orders_business_name_length check (char_length(business_name) between 1 and 120),
  business_address text      not null
    constraint orders_business_address_length check (char_length(business_address) between 1 and 300),
  status         text        not null default 'pending'
    constraint orders_status_valid check (
      status in ('pending', 'accepted', 'preparing', 'ready', 'picked_up', 'cancelled')
    ),
  pickup_at      timestamptz,
  total_cop      integer     not null constraint orders_total_non_negative check (total_cop >= 0),
  notes          text        constraint orders_notes_length check (notes is null or char_length(notes) <= 200),
  payment_method text        not null default 'pay_at_pickup'
    constraint orders_payment_method_valid check (payment_method in ('pay_at_pickup')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint orders_pkey primary key (id)
);

comment on table  public.orders           is 'Pick-up orders. Written only by the order functions.';
comment on column public.orders.business_id is 'NULL once the business is deleted; the copies below remain.';
comment on column public.orders.business_name is 'Business name copied when the order was created.';
comment on column public.orders.business_address is 'Business address copied when the order was created.';
comment on column public.orders.pickup_at is 'Requested pick-up time; NULL means as soon as possible.';
comment on column public.orders.total_cop is 'Whole COP, always computed on the server from menu_items.price_cop.';

create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_business_idx on public.orders (business_id, created_at desc);
create index if not exists orders_user_pending_idx on public.orders (user_id) where status = 'pending';

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row
  execute procedure public.set_updated_at();

-- 3. order_items ------------------------------------------------------------
-- name and unit_price_cop are copies taken when the order was created, so the
-- order keeps its history if the menu item changes or is deleted.
create table if not exists public.order_items (
  id             uuid    not null default gen_random_uuid(),
  order_id       uuid    not null references public.orders (id) on delete cascade,
  menu_item_id   uuid    references public.menu_items (id) on delete set null,
  name           text    not null constraint order_items_name_length check (char_length(name) between 1 and 80),
  unit_price_cop integer not null constraint order_items_price_non_negative check (unit_price_cop >= 0),
  quantity       integer not null constraint order_items_quantity_range check (quantity between 1 and 20),

  constraint order_items_pkey primary key (id)
);

comment on table public.order_items is 'Lines of an order, copied from the menu at order time.';

create index if not exists order_items_order_idx on public.order_items (order_id);

-- 4. Row Level Security -----------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "orders: customer reads own" on public.orders;
create policy "orders: customer reads own"
  on public.orders for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "order_items: customer reads own" on public.order_items;
create policy "order_items: customer reads own"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = (select auth.uid())
    )
  );

-- 5. Grants -----------------------------------------------------------------
revoke all on public.app_settings, public.orders, public.order_items from anon, authenticated;
grant select on public.orders, public.order_items to authenticated;

notify pgrst, 'reload schema';
