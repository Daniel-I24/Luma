-- -----------------------------------------------------------------------------
-- Migration: trust_tiers
-- Why an order was cancelled, no-show strikes and the customer trust tier.
--   1. orders.cancel_reason ('out_of_stock', 'closed', 'no_show', 'other'),
--      ready_at and cancelled_at (set by a trigger when the status changes).
--   2. set_order_status(order, status, reason): the 2-argument version is
--      dropped and replaced (reason defaults to null, so old calls keep
--      working). Cancelling after accepting needs a reason; 'no_show' only
--      from 'ready' and at least no_show_min_minutes (15) after it was ready.
--   3. customer_strikes(user) (internal): active no-show strikes since the
--      last admin clear, and when a restriction would end. The tiers and the
--      RPCs built on it are in 20261030000210_trust_status.sql.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

alter table public.orders
  add column if not exists cancel_reason text
    constraint orders_cancel_reason_valid
      check (cancel_reason is null or cancel_reason in ('out_of_stock', 'closed', 'no_show', 'other')),
  add column if not exists ready_at timestamptz,
  add column if not exists cancelled_at timestamptz;

create index if not exists orders_user_no_show_idx on public.orders (user_id, cancelled_at)
  where cancel_reason = 'no_show';

insert into public.app_settings (key, int_value) values
  ('no_show_min_minutes', 15),
  ('trust_restricted_strikes', 3),
  ('trust_strike_window_days', 30),
  ('trust_trusted_min_picked_up', 2),
  ('trust_new_max_pending_pickup', 1),
  ('trust_new_max_daily', 3)
on conflict (key) do nothing;

create or replace function public.orders_status_times()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'ready' then new.ready_at := now(); end if;
    if new.status = 'cancelled' then new.cancelled_at := now(); end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.orders_status_times() from public, anon, authenticated;
drop trigger if exists orders_status_times on public.orders;
create trigger orders_status_times
  before update of status on public.orders
  for each row execute function public.orders_status_times();

-- 2. set_order_status with a reason ------------------------------------------------
drop function if exists public.set_order_status(uuid, text);

create or replace function public.set_order_status(p_order_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_ready  timestamptz;
begin
  select o.status, o.ready_at into v_status, v_ready
  from public.orders o
  join public.businesses b on b.id = o.business_id
  where o.id = p_order_id and b.owner_id = auth.uid()
  for update of o;
  if not found then
    raise exception using errcode = 'P0001', message = 'order_not_found';
  end if;
  if (v_status, p_status) not in (
    ('pending', 'accepted'), ('pending', 'cancelled'), ('accepted', 'preparing'),
    ('preparing', 'ready'), ('ready', 'picked_up'),
    ('accepted', 'cancelled'), ('preparing', 'cancelled'), ('ready', 'cancelled')
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_transition';
  end if;
  if (p_status <> 'cancelled' and p_reason is not null)
     or (p_reason is not null and p_reason not in ('out_of_stock', 'closed', 'no_show', 'other')) then
    raise exception using errcode = 'P0001', message = 'invalid_reason';
  end if;
  if p_status = 'cancelled' and v_status <> 'pending' and p_reason is null then
    raise exception using errcode = 'P0001', message = 'reason_required';
  end if;
  if p_reason = 'no_show' and (v_status <> 'ready' or v_ready is null or v_ready
      + make_interval(mins => coalesce((select s.int_value from public.app_settings s
                                        where s.key = 'no_show_min_minutes'), 15)) > now()) then
    raise exception using errcode = 'P0001', message = 'no_show_too_early';
  end if;
  update public.orders set status = p_status, cancel_reason = p_reason where id = p_order_id;
end;
$$;

revoke execute on function public.set_order_status(uuid, text, text) from public, anon;
grant execute on function public.set_order_status(uuid, text, text) to authenticated;

-- 3. Trust tier ----------------------------------------------------------------------
create or replace function public.customer_strikes(p_user uuid)
returns table (strikes integer, restricted_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with counted as (
    select o.cancelled_at from public.orders o
    join public.profiles p on p.id = o.user_id
    where o.user_id = p_user and o.cancel_reason = 'no_show'
      and o.cancelled_at > now() - make_interval(days => coalesce(
            (select s.int_value from public.app_settings s where s.key = 'trust_strike_window_days'), 30))
      and o.cancelled_at > coalesce(p.strikes_cleared_at, '-infinity')
  ), limits as (
    select coalesce((select s.int_value from public.app_settings s where s.key = 'trust_restricted_strikes'), 3) as n,
           coalesce((select s.int_value from public.app_settings s where s.key = 'trust_strike_window_days'), 30) as days
  )
  -- Restricted until enough strikes age out: the n-th most recent one leaves the window.
  select (select count(*)::integer from counted),
         (select c.cancelled_at + make_interval(days => l.days) from counted c, limits l
          where (select count(*) from counted) >= l.n
          order by c.cancelled_at desc offset (select n - 1 from limits) limit 1)
$$;

revoke execute on function public.customer_strikes(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
