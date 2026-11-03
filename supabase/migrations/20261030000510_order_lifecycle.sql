-- -----------------------------------------------------------------------------
-- Migration: order_lifecycle
--   1. notify_order_created: no owner notification while an order waits for
--      its online payment.
--   2. notify_order_status_changed: awaiting_payment -> pending (payment
--      approved) tells the owner 'order_new'; an unpaid order that is
--      cancelled is never shown to the owner; picked_up also sends the
--      customer one 'review_invite' (with push). The rest is unchanged.
--   3. business_orders: excludes 'awaiting_payment' and adds payment_status,
--      cancel_reason, ready_at and customer_avatar_path (only while the order
--      is accepted, preparing or ready and the customer shares the photo).
--   4. expire_stale_orders: also cancels orders awaiting payment for more
--      than payment_awaiting_expiry_minutes (15).
-- Same signatures and grants.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

create or replace function public.notify_order_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'awaiting_payment' then
    return new;
  end if;
  insert into public.notifications (user_id, type, order_id, status)
  select b.owner_id, 'order_new', new.id, new.status from public.businesses b where b.id = new.business_id;
  return new;
end;
$$;

revoke execute on function public.notify_order_created() from public, anon, authenticated;

create or replace function public.notify_order_status_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if old.status = 'awaiting_payment' then
    if new.status = 'pending' then
      insert into public.notifications (user_id, type, order_id, status)
      select b.owner_id, 'order_new', new.id, new.status from public.businesses b where b.id = new.business_id;
    elsif new.user_id is not null and new.user_id is distinct from (select auth.uid()) then
      insert into public.notifications (user_id, type, order_id, status)
      values (new.user_id, 'order_status', new.id, new.status);
    end if;
    return new;
  end if;
  if new.user_id is not null and new.user_id = (select auth.uid()) then
    if new.status = 'cancelled' then
      insert into public.notifications (user_id, type, order_id, status)
      select b.owner_id, 'order_cancelled', new.id, new.status from public.businesses b where b.id = new.business_id;
    end if;
  elsif new.user_id is not null then
    insert into public.notifications (user_id, type, order_id, status)
    values (new.user_id, 'order_status', new.id, new.status);
    if new.status = 'picked_up' and not exists (
      select 1 from public.notifications n where n.order_id = new.id and n.type = 'review_invite') then
      insert into public.notifications (user_id, type, order_id, business_id)
      values (new.user_id, 'review_invite', new.id, new.business_id);
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.notify_order_status_changed() from public, anon, authenticated;

create or replace view public.business_orders
  with (security_invoker = false, security_barrier = true)
as
select
  o.id, o.business_id, o.status, o.pickup_at, o.total_cop, o.notes, o.payment_method, o.created_at, o.updated_at,
  nullif(btrim(p.display_name), '') as customer_label,
  o.payment_status,
  o.cancel_reason,
  o.ready_at,
  case when o.status in ('accepted', 'preparing', 'ready') and p.show_avatar_to_business
       then p.avatar_path end as customer_avatar_path
from public.orders o
join public.businesses b on b.id = o.business_id
left join public.profiles p on p.id = o.user_id
where b.owner_id = (select auth.uid()) and o.status <> 'awaiting_payment';

comment on view public.business_orders is
  'Orders of the caller''s businesses once payable to them, without user_id or email.';
revoke all on public.business_orders from public, anon, authenticated;
grant select on public.business_orders to authenticated;

create or replace function public.expire_stale_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_minutes integer := coalesce(
    (select s.int_value from public.app_settings s where s.key = 'order_pending_expiry_minutes'), 30);
  v_payment_minutes integer := coalesce(
    (select s.int_value from public.app_settings s where s.key = 'payment_awaiting_expiry_minutes'), 15);
  v_count integer;
begin
  update public.orders o
  set status = 'cancelled'
  where (o.status = 'pending'
         and coalesce(o.pickup_at, o.created_at) + make_interval(mins => v_minutes) < now())
     or (o.status = 'awaiting_payment' and o.created_at + make_interval(mins => v_payment_minutes) < now());
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.expire_stale_orders() from public, anon, authenticated;
grant execute on function public.expire_stale_orders() to service_role;

notify pgrst, 'reload schema';
