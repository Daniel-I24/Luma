-- -----------------------------------------------------------------------------
-- Migration: payment_service
-- What the payment Edge Functions need besides apply_payment_event.
--   1. payment_event_seen(transaction, status): service_role only. Lets
--      wompi-webhook stop a repeated event before asking the Wompi API
--      (payment_events stays closed even to service_role).
--   2. payment_attempt(reference): service_role only. Amount, currency and
--      environment of an attempt, to match the confirmed transaction.
--   3. admin_note_reconcile(): an admin with aal2 runs reconcile-payments on
--      demand; the request is logged.
--   4. private.payments_cron: URL of reconcile-payments and its shared secret
--      (PAYMENTS_CRON_SECRET), readable by no client role; pg_cron calls it
--      every 5 minutes where pg_cron and pg_net exist (conditional block).
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

create or replace function public.payment_event_seen(p_transaction_id text, p_status text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.payment_events e
                 where e.provider_transaction_id = p_transaction_id and e.provider_status = p_status)
$$;

revoke execute on function public.payment_event_seen(text, text) from public, anon, authenticated;
grant execute on function public.payment_event_seen(text, text) to service_role;

create or replace function public.payment_attempt(p_reference text)
returns table (amount_in_cents bigint, currency text, environment text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.amount_in_cents, p.currency, p.environment, p.status from public.payments p where p.reference = p_reference
$$;

revoke execute on function public.payment_attempt(text) from public, anon, authenticated;
grant execute on function public.payment_attempt(text) to service_role;

create or replace function public.admin_note_reconcile()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  perform public.log_admin_action('reconcile_payments', 'system', null);
end;
$$;

revoke execute on function public.admin_note_reconcile() from public, anon;
grant execute on function public.admin_note_reconcile() to authenticated;

-- 4. Cron ----------------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.payments_cron (
  id           boolean not null default true constraint payments_cron_single check (id),
  function_url text    not null constraint payments_cron_https check (function_url ~ '^https://'),
  secret       text    not null constraint payments_cron_secret_length check (char_length(secret) >= 32),
  constraint payments_cron_pkey primary key (id)
);
revoke all on private.payments_cron from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'luma-reconcile-payments';
    perform cron.schedule('luma-reconcile-payments', '*/5 * * * *', $job$
      select net.http_post(url := c.function_url, body := '{}'::jsonb,
               headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', c.secret))
      from private.payments_cron c
      where exists (select 1 from public.payments p where p.status in ('pending', 'declined', 'error')
                    and p.candidate_transaction_id is not null and p.created_at > now() - interval '2 days')
    $job$);
  end if;
end;
$$;

notify pgrst, 'reload schema';
