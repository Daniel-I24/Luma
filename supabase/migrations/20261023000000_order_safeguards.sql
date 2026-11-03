-- -----------------------------------------------------------------------------
-- Migration: order_safeguards
--   1. Settings of the hourly order caps enforced by create_order
--      (20261021000000_promotion_discounts.sql, final definition).
--   2. expire_stale_orders(): cancels pending orders nobody accepted within
--      order_pending_expiry_minutes (30) of their pick-up time (or creation for
--      "as soon as possible"). Only service_role and postgres may run it. The
--      status trigger then notifies the customer (auth.uid() is null there).
--   3. Every 5 minutes with pg_cron when the extension is available (enable it
--      in the dashboard: Database > Extensions > pg_cron); nothing otherwise.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

insert into public.app_settings (key, int_value) values
  ('order_max_per_hour_per_user', 6),
  ('order_max_per_hour_per_business', 2),
  ('order_pending_expiry_minutes', 30)
on conflict (key) do nothing;

create or replace function public.expire_stale_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_minutes integer := coalesce(
    (select s.int_value from public.app_settings s where s.key = 'order_pending_expiry_minutes'), 30);
  v_count integer;
begin
  update public.orders o
  set status = 'cancelled'
  where o.status = 'pending'
    and coalesce(o.pickup_at, o.created_at) + make_interval(mins => v_minutes) < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.expire_stale_orders() from public, anon, authenticated;
grant execute on function public.expire_stale_orders() to service_role;

-- Schedule only where pg_cron exists (Supabase, once enabled); harmless elsewhere.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'luma-expire-stale-orders';
    perform cron.schedule('luma-expire-stale-orders', '*/5 * * * *', 'select public.expire_stale_orders()');
  end if;
end;
$$;

notify pgrst, 'reload schema';
