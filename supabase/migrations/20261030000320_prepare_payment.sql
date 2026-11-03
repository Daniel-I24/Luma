-- -----------------------------------------------------------------------------
-- Migration: prepare_payment
--   1. payment_config(): whether online payment is on and whether it is the
--      sandbox (the app shows the "test mode" banner). Nothing secret.
--   2. prepare_payment(order, environment): only the customer of the order,
--      online and awaiting payment, not paid, not expired, at most
--      payment_max_attempts (3). Creates an attempt with an unpredictable
--      reference and the amount from orders.total_cop (in cents) and returns
--      what create-payment signs. environment must match payments_production.
--   3. my_order_payment(order): payment status, attempts used and when the
--      order stops waiting for its payment (the customer's own order only).
--   4. record_payment_redirect(order, transaction): stores the transaction id
--      Wompi put in the redirect, untrusted, for reconcile-payments to check
--      with the API. It never changes a status.
-- Depends on 20261030000310_payment_events.sql.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

insert into public.app_settings (key, int_value) values
  ('rate_create_payment_max', 10),
  ('rate_create_payment_window_seconds', 600)
on conflict (key) do nothing;

create or replace function public.payment_config()
returns table (enabled boolean, sandbox boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select int_value from public.app_settings where key = 'payments_enabled'), 0) = 1,
         coalesce((select int_value from public.app_settings where key = 'payments_production'), 0) = 0
$$;

revoke execute on function public.payment_config() from public, anon;
grant execute on function public.payment_config() to authenticated;

create or replace function public.prepare_payment(p_order_id uuid, p_environment text)
returns table (reference text, amount_in_cents bigint, currency text, expires_at timestamptz, attempt smallint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   record;
  v_expires timestamptz;
  v_attempt smallint;
  v_ref     text := 'luma_' || replace(gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  if not public.is_email_confirmed() then
    raise exception using errcode = 'P0001', message = 'email_not_confirmed';
  end if;
  if not (select c.enabled from public.payment_config() c) then
    raise exception using errcode = 'P0001', message = 'payments_disabled';
  end if;
  if p_environment is distinct from (case when (select c.sandbox from public.payment_config() c) then 'test' else 'prod' end) then
    raise exception using errcode = 'P0001', message = 'payments_misconfigured';
  end if;
  select o.id, o.status, o.payment_method, o.payment_status, o.total_cop, o.created_at into v_order
  from public.orders o where o.id = p_order_id and o.user_id = auth.uid() for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'order_not_found';
  end if;
  if v_order.payment_status = 'approved' then
    raise exception using errcode = 'P0001', message = 'already_paid';
  end if;
  if v_order.payment_method <> 'online' or v_order.status <> 'awaiting_payment' then
    raise exception using errcode = 'P0001', message = 'order_not_payable';
  end if;
  v_expires := v_order.created_at + make_interval(mins => coalesce(
    (select s.int_value from public.app_settings s where s.key = 'payment_awaiting_expiry_minutes'), 15));
  if v_expires < now() + interval '1 minute' then
    raise exception using errcode = 'P0001', message = 'payment_expired';
  end if;
  select coalesce(max(p.attempt), 0) + 1 into v_attempt from public.payments p where p.order_id = p_order_id;
  if v_attempt > coalesce((select s.int_value from public.app_settings s where s.key = 'payment_max_attempts'), 3) then
    raise exception using errcode = 'P0001', message = 'too_many_attempts';
  end if;
  insert into public.payments (order_id, attempt, reference, environment, amount_in_cents, expires_at)
  values (p_order_id, v_attempt, v_ref, p_environment, v_order.total_cop::bigint * 100, v_expires);
  update public.orders set payment_status = 'pending' where id = p_order_id;
  return query select v_ref, v_order.total_cop::bigint * 100, 'COP'::text, v_expires, v_attempt;
end;
$$;

revoke execute on function public.prepare_payment(uuid, text) from public, anon;
grant execute on function public.prepare_payment(uuid, text) to authenticated;

create or replace function public.my_order_payment(p_order_id uuid)
returns table (payment_status text, attempts_used integer, attempts_max integer, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.payment_status,
         (select count(*)::integer from public.payments p where p.order_id = o.id),
         coalesce((select s.int_value from public.app_settings s where s.key = 'payment_max_attempts'), 3),
         case when o.payment_method = 'online' then o.created_at + make_interval(mins => coalesce(
           (select s.int_value from public.app_settings s where s.key = 'payment_awaiting_expiry_minutes'), 15)) end
  from public.orders o
  where o.id = p_order_id and o.user_id = (select auth.uid())
$$;

revoke execute on function public.my_order_payment(uuid) from public, anon;
grant execute on function public.my_order_payment(uuid) to authenticated;

create or replace function public.record_payment_redirect(p_order_id uuid, p_transaction_id text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with latest as (
    select p.id from public.payments p
    join public.orders o on o.id = p.order_id
    where p.order_id = p_order_id and o.user_id = (select auth.uid())
      and p.status in ('pending', 'declined', 'error')
      and p_transaction_id ~ '^[0-9A-Za-z_-]{1,64}$'
    order by p.attempt desc limit 1
  )
  update public.payments p set candidate_transaction_id = p_transaction_id
  from latest where p.id = latest.id
  returning true
$$;

revoke execute on function public.record_payment_redirect(uuid, text) from public, anon;
grant execute on function public.record_payment_redirect(uuid, text) to authenticated;

notify pgrst, 'reload schema';
