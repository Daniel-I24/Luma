-- -----------------------------------------------------------------------------
-- Migration: cron_jobs (pending review).
-- Production had only two jobs: the migrations of luma-expire-stale-orders and
-- luma-reconcile-payments ran before pg_cron was on, so they skipped their block.
-- Orders never expired by themselves and nothing reconciled on its own.
--   1. private.reconcile_work_pending(): open attempts, as before, and also the
--      card refunds that can be voided (payments_to_void), which never woke the job.
--   2. Both jobs are scheduled again. When this is applied, orders past their
--      expiry are cancelled by the first run (docs/payments.md).
-- Without pg_cron or pg_net the block does nothing, like the others.
-- -----------------------------------------------------------------------------

create function private.reconcile_work_pending()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.payments p
    where p.created_at > now() - interval '2 days'
      and p.status in ('pending', 'declined', 'error')
      and p.candidate_transaction_id is not null
  ) or exists (select 1 from public.payments_to_void())
$$;

revoke execute on function private.reconcile_work_pending() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'luma-expire-stale-orders';
    perform cron.schedule('luma-expire-stale-orders', '*/5 * * * *', 'select public.expire_stale_orders()');
  end if;
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'luma-reconcile-payments';
    perform cron.schedule('luma-reconcile-payments', '*/5 * * * *', $job$
      select net.http_post(url := c.function_url, body := '{}'::jsonb,
               headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', c.secret))
      from private.payments_cron c
      where private.reconcile_work_pending()
    $job$);
  end if;
end;
$$;

notify pgrst, 'reload schema';
