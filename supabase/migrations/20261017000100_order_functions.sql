-- -----------------------------------------------------------------------------
-- Migration: order_functions
-- The only way to create orders (status changes: next migration). NOT APPLIED YET.
-- SECURITY DEFINER with an empty search_path (every name is qualified).
-- Errors are raised with a machine-readable message (e.g. 'too_many_pending')
-- that the app maps to translated texts. Executable only by authenticated.
-- -----------------------------------------------------------------------------

-- Creates a pending pick-up order and returns its id. Lines arrive as
-- [{"menu_item_id": "<uuid>", "quantity": 1-20}, ...]; any other field (e.g.
-- a price) is ignored: the total always comes from menu_items.price_cop.
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
  v_user     uuid := auth.uid();
  v_notes    text := nullif(btrim(p_notes), '');
  v_distinct  integer;
  v_available integer;
  v_total    bigint;
  v_order_id uuid;
  v_business record;
begin
  if v_user is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  select b.name, b.address into v_business
  from public.businesses b
  where b.id = p_business_id and b.is_active;
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

  -- Each item once, from this business, still available.
  with lines as (
    select (e ->> 'menu_item_id')::uuid as menu_item_id, (e ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_items) e
  )
  select count(distinct l.menu_item_id), count(m.id), sum(m.price_cop::bigint * l.quantity)
    into v_distinct, v_available, v_total
  from lines l
  left join public.menu_items m
    on m.id = l.menu_item_id and m.business_id = p_business_id and m.is_available;
  if v_distinct <> jsonb_array_length(p_items) then
    raise exception using errcode = 'P0001', message = 'duplicate_items';
  end if;
  if v_available <> v_distinct then
    raise exception using errcode = 'P0001', message = 'item_unavailable';
  end if;

  if p_pickup_at is not null
     and (p_pickup_at < now() + interval '10 minutes' or p_pickup_at > now() + interval '7 days') then
    raise exception using errcode = 'P0001', message = 'invalid_pickup_time';
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

  insert into public.order_items (order_id, menu_item_id, name, unit_price_cop, quantity)
  select v_order_id, m.id, m.name, m.price_cop, (e ->> 'quantity')::integer
  from jsonb_array_elements(p_items) e
  join public.menu_items m on m.id = (e ->> 'menu_item_id')::uuid;

  return v_order_id;
end;
$$;

revoke execute on function public.create_order(uuid, jsonb, timestamptz, text) from public, anon;
grant execute on function public.create_order(uuid, jsonb, timestamptz, text) to authenticated;

notify pgrst, 'reload schema';
