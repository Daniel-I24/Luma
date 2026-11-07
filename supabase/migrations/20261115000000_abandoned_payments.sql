-- -----------------------------------------------------------------------------
-- Migration: abandoned_payments (pending review).
-- An attempt that never reached Wompi (no transaction id, no event) stayed
-- 'pending' forever: the expiry job cancelled its order, the reconciliation
-- cannot ask Wompi without a transaction id, and after an hour the admin saw it
-- in "Pagos con problemas" (the 12:13-12:19 attempts of 2026-11-07, created
-- while the redirect URL was rejected).
--   1. payments.status and orders.payment_status also say 'expired'.
--   2. payment_transition_allowed: pending -> expired, and expired -> approved
--      (a payment Wompi reports late is still recorded; on a cancelled order it
--      becomes refund_required, as before). Vectors in
--      supabase/tests/fixtures/payment_transitions.json (TypeScript mirrors it).
--   3. expire_abandoned_payments(): closes those attempts once they are past
--      their expiry plus a grace period (default 30 minutes, at least 15), and
--      marks the order as unpaid when it was the order's last attempt and the
--      order is not paid. Service role only.
--   4. The luma-expire-stale-orders job also runs it, every 5 minutes.
-- -----------------------------------------------------------------------------

alter table public.payments drop constraint payments_status_valid;
alter table public.payments add constraint payments_status_valid check (status in
  ('pending', 'approved', 'declined', 'voided', 'refund_required', 'refunded', 'error', 'expired'));

alter table public.orders drop constraint orders_payment_status_valid;
alter table public.orders add constraint orders_payment_status_valid check (payment_status in
  ('none', 'pending', 'approved', 'declined', 'voided', 'refund_required', 'refunded', 'error', 'expired'));

create or replace function public.payment_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from, p_to) in (
    ('pending', 'approved'), ('pending', 'declined'), ('pending', 'error'), ('pending', 'voided'),
    ('pending', 'expired'),
    ('declined', 'approved'), ('error', 'approved'), ('expired', 'approved'),
    ('approved', 'voided'), ('approved', 'refund_required'),
    ('refund_required', 'refunded'), ('refund_required', 'voided')
  )
$$;

revoke execute on function public.payment_transition_allowed(text, text) from public, anon;
grant execute on function public.payment_transition_allowed(text, text) to authenticated, service_role;

create function public.expire_abandoned_payments(p_grace_minutes integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grace interval := make_interval(mins => greatest(coalesce(p_grace_minutes, 30), 15));
  v_count integer;
begin
  with closed as (
    update public.payments p
    set status = 'expired'
    where p.status = 'pending'
      and p.candidate_transaction_id is null
      and p.approved_transaction_id is null
      and p.expires_at < now() - v_grace
      and not exists (select 1 from public.payment_events e where e.payment_id = p.id)
    returning p.order_id, p.attempt
  ), last_attempts as (
    update public.orders o
    set payment_status = 'expired'
    from closed c
    where o.id = c.order_id
      and o.payment_status = 'pending'
      and c.attempt = (select max(p.attempt) from public.payments p where p.order_id = o.id)
    returning o.id
  )
  select count(*) into v_count from closed;
  return v_count;
end;
$$;

revoke execute on function public.expire_abandoned_payments(integer) from public, anon, authenticated;
grant execute on function public.expire_abandoned_payments(integer) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'luma-expire-stale-orders';
    perform cron.schedule('luma-expire-stale-orders', '*/5 * * * *',
      'select public.expire_stale_orders(), public.expire_abandoned_payments()');
  end if;
end;
$$;

notify pgrst, 'reload schema';
