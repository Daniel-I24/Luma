-- -----------------------------------------------------------------------------
-- Migration: create_order_final
-- The ONE final definition of create_order. The 4-argument version is
-- dropped; the new one adds p_payment_method ('pay_at_pickup' by default, so
-- old calls behave the same). Every protection, in order:
--   session, confirmed email, complete profile, verified phone (when
--   required), public business, not paused, item shape, no duplicates,
--   available items, server prices (order_line_prices), pick-up window,
--   opening hours, notes, total cap, payment method (online needs
--   payments_enabled), trust tier (restricted: online only, else
--   account_restricted; new: 1 pending pay-at-pickup order and 3 orders a
--   day), pending orders (awaiting_payment counts), hourly caps.
-- An online order starts in 'awaiting_payment': invisible to the business
-- and without an owner notification until its payment is approved.
-- supabase/tests/create_order_final.sql fails if any protection goes missing.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

drop function if exists public.create_order(uuid, jsonb, timestamptz, text);

create or replace function public.create_order(
  p_business_id uuid, p_items jsonb, p_pickup_at timestamptz default null, p_notes text default null,
  p_payment_method text default 'pay_at_pickup'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_notes    text := nullif(btrim(p_notes), '');
  v_now      timestamptz := now();
  v_distinct integer;
  v_available integer;
  v_total    bigint;
  v_order_id uuid;
  v_business record;
  v_tier     text;
begin
  if v_user is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  if not public.is_email_confirmed() then
    raise exception using errcode = 'P0001', message = 'email_not_confirmed';
  end if;
  if not public.is_profile_complete() then
    raise exception using errcode = 'P0001', message = 'profile_incomplete';
  end if;
  if not public.phone_check_passed() then
    raise exception using errcode = 'P0001', message = 'phone_not_verified';
  end if;
  select b.name, b.address into v_business
  from public.businesses b where b.id = p_business_id and public.is_business_public(b.id);
  if not found then
    raise exception using errcode = 'P0001', message = 'business_unavailable';
  end if;
  if public.business_paused(p_business_id) then
    raise exception using errcode = 'P0001', message = 'business_paused';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20
     or exists (
       select 1 from jsonb_array_elements(p_items) e
       where jsonb_typeof(e) <> 'object'
          or jsonb_typeof(e -> 'menu_item_id') is distinct from 'string'
          or (e ->> 'menu_item_id') !~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
          or jsonb_typeof(e -> 'quantity') is distinct from 'number'
          or case when (e ->> 'quantity') ~ '^[0-9]{1,2}$' then (e ->> 'quantity')::integer not between 1 and 20
                  else true end) then
    raise exception using errcode = 'P0001', message = 'invalid_items';
  end if;
  select count(distinct (e ->> 'menu_item_id')::uuid) into v_distinct from jsonb_array_elements(p_items) e;
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
  if not public.business_open_at(p_business_id, coalesce(p_pickup_at, v_now)) then
    raise exception using errcode = 'P0001', message = 'business_closed';
  end if;
  if char_length(v_notes) > 200 then
    raise exception using errcode = 'P0001', message = 'invalid_notes';
  end if;
  if v_total > coalesce((select s.int_value from public.app_settings s where s.key = 'order_max_total_cop'), 500000) then
    raise exception using errcode = 'P0001', message = 'total_too_high';
  end if;
  if p_payment_method is null or p_payment_method not in ('pay_at_pickup', 'online') then
    raise exception using errcode = 'P0001', message = 'invalid_payment_method';
  end if;
  if p_payment_method = 'online' and not (select c.enabled from public.payment_config() c) then
    raise exception using errcode = 'P0001', message = 'payments_disabled';
  end if;

  -- One order creation at a time per user, so every count below holds.
  perform pg_advisory_xact_lock(hashtextextended('create_order:' || v_user::text, 0));
  v_tier := public.customer_trust_tier(v_user);
  if v_tier = 'restricted' and p_payment_method <> 'online' then
    raise exception using errcode = 'P0001', message = 'account_restricted';
  end if;
  if v_tier = 'new' and p_payment_method = 'pay_at_pickup' and (select count(*) from public.orders o
       where o.user_id = v_user and o.payment_method = 'pay_at_pickup'
         and o.status in ('pending', 'accepted', 'preparing', 'ready'))
     >= coalesce((select s.int_value from public.app_settings s where s.key = 'trust_new_max_pending_pickup'), 1) then
    raise exception using errcode = 'P0001', message = 'trust_pending_limit';
  end if;
  if v_tier = 'new' and (select count(*) from public.orders o
       where o.user_id = v_user and public.app_local_time(o.created_at)::date = public.app_local_time(v_now)::date)
     >= coalesce((select s.int_value from public.app_settings s where s.key = 'trust_new_max_daily'), 3) then
    raise exception using errcode = 'P0001', message = 'trust_daily_limit';
  end if;
  if (select count(*) from public.orders o where o.user_id = v_user and o.status in ('pending', 'awaiting_payment'))
     >= coalesce((select s.int_value from public.app_settings s where s.key = 'order_max_pending_per_user'), 5) then
    raise exception using errcode = 'P0001', message = 'too_many_pending';
  end if;
  -- Hourly caps count every order, cancelled ones too (no create/cancel loops).
  if (select count(*) from public.orders o where o.user_id = v_user and o.created_at > v_now - interval '1 hour')
     >= coalesce((select s.int_value from public.app_settings s where s.key = 'order_max_per_hour_per_user'), 6)
     or (select count(*) from public.orders o
         where o.user_id = v_user and o.business_id = p_business_id and o.created_at > v_now - interval '1 hour')
     >= coalesce((select s.int_value from public.app_settings s where s.key = 'order_max_per_hour_per_business'), 2) then
    raise exception using errcode = 'P0001', message = 'too_many_orders';
  end if;

  insert into public.orders (user_id, business_id, business_name, business_address, pickup_at, total_cop, notes,
                             payment_method, status)
  values (v_user, p_business_id, v_business.name, v_business.address, p_pickup_at, v_total, v_notes, p_payment_method,
          case when p_payment_method = 'online' then 'awaiting_payment' else 'pending' end)
  returning id into v_order_id;
  insert into public.order_items (order_id, menu_item_id, name, unit_price_cop, list_price_cop, promotion_id, quantity)
  select v_order_id, l.menu_item_id, l.name, l.unit_price_cop, l.list_price_cop, l.promotion_id, l.quantity
  from public.order_line_prices(p_business_id, p_items, v_now) l;
  return v_order_id;
end;
$$;

revoke execute on function public.create_order(uuid, jsonb, timestamptz, text, text) from public, anon;
grant execute on function public.create_order(uuid, jsonb, timestamptz, text, text) to authenticated;

notify pgrst, 'reload schema';
