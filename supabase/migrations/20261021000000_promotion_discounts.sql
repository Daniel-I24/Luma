-- -----------------------------------------------------------------------------
-- Migration: promotion_discounts
-- Promotions can discount one menu item, and create_order applies it.
--   1. promotions.menu_item_id (optional) and discount_percent (5-90, needs an
--      item). The item must belong to the same business, and a business has
--      at most 5 active promotions (trigger). ends_at > starts_at is already a
--      CHECK (promotions_dates_order); public reads stay "public business and
--      current promotion" (public_visibility).
--   2. order_items keeps the list price, the final price (unit_price_cop) and
--      the promotion applied.
--   3. order_line_prices: the one place that prices order lines. The best
--      current promotion of each item wins; the final price is
--      round(list * (100 - percent) / 100) to the nearest peso, halves up
--      (e.g. 9990 at 15% = 8491.5 -> 8492). Prices sent by the app are never
--      read: the client only sends item ids and quantities.
--   4. create_order uses it for the total and the lines.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

-- 1. Discounts on promotions --------------------------------------------------
alter table public.promotions
  add column if not exists menu_item_id uuid references public.menu_items (id) on delete cascade,
  add column if not exists discount_percent smallint;

alter table public.promotions
  add constraint promotions_discount_range
    check (discount_percent is null or discount_percent between 5 and 90),
  add constraint promotions_discount_needs_item
    check (discount_percent is null or menu_item_id is not null);

create index if not exists promotions_menu_item_idx on public.promotions (menu_item_id)
  where menu_item_id is not null;

comment on column public.promotions.discount_percent is
  'Percent off the price of menu_item_id while the promotion is current (5-90).';

-- Most promotions that may be active at the same time per business.
insert into public.app_settings (key, int_value)
values ('promotion_max_active_per_business', 5)
on conflict (key) do nothing;

create or replace function public.promotions_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.menu_item_id is not null and not exists (
    select 1 from public.menu_items m
    where m.id = new.menu_item_id and m.business_id = new.business_id
  ) then
    raise exception using errcode = 'P0001', message = 'promotion_item_mismatch';
  end if;
  if new.is_active and new.ends_at > now() then
    -- Serialise per business so two inserts cannot both pass the count.
    perform pg_advisory_xact_lock(hashtextextended('promotions:' || new.business_id::text, 0));
    if (select count(*) from public.promotions p
        where p.business_id = new.business_id and p.id <> new.id
          and p.is_active and p.ends_at > now())
       >= coalesce((select s.int_value from public.app_settings s
                    where s.key = 'promotion_max_active_per_business'), 5) then
      raise exception using errcode = 'P0001', message = 'promotion_limit';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.promotions_guard() from public, anon, authenticated;

drop trigger if exists promotions_guard on public.promotions;
create trigger promotions_guard
  before insert or update of business_id, menu_item_id, is_active, ends_at on public.promotions
  for each row execute function public.promotions_guard();

-- Owners write the new columns (column grants, as for the rest).
grant insert (business_id, title, description, image_url, starts_at, ends_at, is_active,
              menu_item_id, discount_percent)
  on public.promotions to authenticated;
grant update (title, description, image_url, starts_at, ends_at, is_active,
              menu_item_id, discount_percent)
  on public.promotions to authenticated;

-- 2. Prices kept on each order line --------------------------------------------
alter table public.order_items
  add column if not exists list_price_cop integer,
  add column if not exists promotion_id uuid references public.promotions (id) on delete set null;

update public.order_items set list_price_cop = unit_price_cop where list_price_cop is null;

alter table public.order_items
  alter column list_price_cop set not null,
  add constraint order_items_list_price_range
    check (list_price_cop >= unit_price_cop);

comment on column public.order_items.unit_price_cop is 'Final price per unit, after the promotion.';
comment on column public.order_items.list_price_cop is 'Menu price per unit at order time.';

-- 3. Pricing of order lines ------------------------------------------------------
create or replace function public.promotion_price(p_list integer, p_percent smallint)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when p_percent is null then p_list
              else round(p_list::numeric * (100 - p_percent) / 100)::integer end
$$;

revoke execute on function public.promotion_price(integer, smallint) from public, anon;
grant execute on function public.promotion_price(integer, smallint) to authenticated;

-- Lines of p_items ({menu_item_id, quantity}) priced at p_at. Only available
-- items of the business; the caller validates the shape and counts.
create or replace function public.order_line_prices(p_business_id uuid, p_items jsonb, p_at timestamptz)
returns table (menu_item_id uuid, name text, quantity integer, list_price_cop integer,
               unit_price_cop integer, promotion_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.name, (e ->> 'quantity')::integer, m.price_cop,
         public.promotion_price(m.price_cop, best.discount_percent), best.id
  from jsonb_array_elements(p_items) e
  join public.menu_items m
    on m.id = (e ->> 'menu_item_id')::uuid and m.business_id = p_business_id and m.is_available
  left join lateral (
    select p.id, p.discount_percent
    from public.promotions p
    where p.menu_item_id = m.id and p.business_id = p_business_id
      and p.discount_percent is not null and p.is_active
      and p_at between p.starts_at and p.ends_at
    order by p.discount_percent desc, p.ends_at, p.id
    limit 1
  ) best on true
$$;

-- Internal: only create_order (SECURITY DEFINER, owned by postgres) calls it.
revoke execute on function public.order_line_prices(uuid, jsonb, timestamptz) from public, anon, authenticated;

-- 4. create_order with server-side discounts -------------------------------------
create or replace function public.create_order(
  p_business_id uuid,
  p_items       jsonb,
  p_pickup_at   timestamptz default null,
  p_notes       text        default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user      uuid := auth.uid();
  v_notes     text := nullif(btrim(p_notes), '');
  v_now       timestamptz := now();
  v_distinct  integer;
  v_available integer;
  v_total     bigint;
  v_order_id  uuid;
  v_business  record;
begin
  if v_user is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  -- Only public businesses (published and verified) take orders.
  select b.name, b.address into v_business
  from public.businesses b
  where b.id = p_business_id and public.is_business_public(b.id);
  if not found then
    raise exception using errcode = 'P0001', message = 'business_unavailable';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 20
     or exists (
       select 1 from jsonb_array_elements(p_items) e
       where jsonb_typeof(e) <> 'object'
          or jsonb_typeof(e -> 'menu_item_id') is distinct from 'string'
          or (e ->> 'menu_item_id') !~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
          or jsonb_typeof(e -> 'quantity') is distinct from 'number'
          or case when (e ->> 'quantity') ~ '^[0-9]{1,2}$'
                  then (e ->> 'quantity')::integer not between 1 and 20
                  else true end
     ) then
    raise exception using errcode = 'P0001', message = 'invalid_items';
  end if;

  -- Each item once, from this business, still available; prices from the server.
  select count(distinct (e ->> 'menu_item_id')::uuid) into v_distinct
  from jsonb_array_elements(p_items) e;
  if v_distinct <> jsonb_array_length(p_items) then
    raise exception using errcode = 'P0001', message = 'duplicate_items';
  end if;
  select count(*), sum(l.unit_price_cop::bigint * l.quantity) into v_available, v_total
  from public.order_line_prices(p_business_id, p_items, v_now) l;
  if v_available <> v_distinct then
    raise exception using errcode = 'P0001', message = 'item_unavailable';
  end if;

  if p_pickup_at is not null
     and (p_pickup_at < v_now + interval '10 minutes' or p_pickup_at > v_now + interval '7 days') then
    raise exception using errcode = 'P0001', message = 'invalid_pickup_time';
  end if;
  -- "Ahora" is checked against now(); a scheduled order against its time.
  if not public.business_open_at(p_business_id, coalesce(p_pickup_at, v_now)) then
    raise exception using errcode = 'P0001', message = 'business_closed';
  end if;
  if char_length(v_notes) > 200 then
    raise exception using errcode = 'P0001', message = 'invalid_notes';
  end if;
  if v_total > coalesce((select s.int_value from public.app_settings s where s.key = 'order_max_total_cop'), 500000) then
    raise exception using errcode = 'P0001', message = 'total_too_high';
  end if;

  -- One order creation at a time per user, so the pending limit holds.
  perform pg_advisory_xact_lock(hashtextextended('create_order:' || v_user::text, 0));
  if (select count(*) from public.orders o where o.user_id = v_user and o.status = 'pending')
     >= coalesce((select s.int_value from public.app_settings s where s.key = 'order_max_pending_per_user'), 5) then
    raise exception using errcode = 'P0001', message = 'too_many_pending';
  end if;

  -- Name and address are copied so the order survives the business.
  insert into public.orders (user_id, business_id, business_name, business_address, pickup_at, total_cop, notes)
  values (v_user, p_business_id, v_business.name, v_business.address, p_pickup_at, v_total, v_notes)
  returning id into v_order_id;

  -- Priced at the same instant as the total (v_now).
  insert into public.order_items (order_id, menu_item_id, name, unit_price_cop, list_price_cop, promotion_id, quantity)
  select v_order_id, l.menu_item_id, l.name, l.unit_price_cop, l.list_price_cop, l.promotion_id, l.quantity
  from public.order_line_prices(p_business_id, p_items, v_now) l;

  return v_order_id;
end;
$$;

revoke execute on function public.create_order(uuid, jsonb, timestamptz, text) from public, anon;
grant execute on function public.create_order(uuid, jsonb, timestamptz, text) to authenticated;

-- Owners see the list price of each line too.
create or replace view public.business_order_items
  with (security_invoker = false, security_barrier = true)
as
select
  i.id,
  i.order_id,
  i.name,
  i.unit_price_cop,
  i.quantity,
  i.list_price_cop
from public.order_items i
join public.orders o on o.id = i.order_id
join public.businesses b on b.id = o.business_id
where b.owner_id = (select auth.uid());

revoke all on public.business_order_items from public, anon, authenticated;
grant select on public.business_order_items to authenticated;

notify pgrst, 'reload schema';
