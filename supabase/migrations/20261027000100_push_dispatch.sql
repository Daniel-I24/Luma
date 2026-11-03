-- -----------------------------------------------------------------------------
-- Migration: push_dispatch
-- How notifications reach push-dispatch (FCM), without the service role
-- key ever being stored in the database.
--   1. private.push_settings: one row with the push-dispatch URL and a
--      shared secret (PUSH_DISPATCH_SECRET of the function). Schema private
--      is not exposed by the API; no client role can read it.
--   2. After each statement inserting notifications, pg_net POSTs an empty
--      poke to push-dispatch. Skipped silently when pg_net or the settings
--      are missing; a failure never blocks the insert.
--   3. pg_cron pokes it every minute (fallback for lost pokes).
--   4. claim_push_batch(limit): service_role only; marks up to 500 unsent
--      notifications of the last day as pushed (at most once) and returns
--      those with tokens and the recipient's consent (orders: notify_orders;
--      promotions: notify_promotions; reviews: always).
--   5. remove_device_tokens(tokens): service_role only (tokens FCM rejects).
-- Depends on 20261027000000_push_notifications.sql.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

-- 1. Settings ----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.push_settings (
  id           boolean not null default true constraint push_settings_single check (id),
  function_url text    not null constraint push_settings_https check (function_url ~ '^https://'),
  secret       text    not null constraint push_settings_secret_length check (char_length(secret) >= 32),
  constraint push_settings_pkey primary key (id)
);
revoke all on private.push_settings from public, anon, authenticated;

-- 2. Poke after inserts -------------------------------------------------------------------
create or replace function public.poke_push_dispatch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings record;
begin
  if to_regnamespace('net') is null then
    return null;
  end if;
  select function_url, secret into v_settings from private.push_settings where id;
  if not found then
    return null;
  end if;
  begin
    execute 'select net.http_post(url := $1, body := $2, headers := $3)'
      using v_settings.function_url, '{}'::jsonb,
            jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_settings.secret);
  exception when others then
    -- The notification is saved anyway; the cron fallback sends it.
    null;
  end;
  return null;
end;
$$;

revoke execute on function public.poke_push_dispatch() from public, anon, authenticated;

drop trigger if exists notifications_poke_push on public.notifications;
create trigger notifications_poke_push
  after insert on public.notifications
  for each statement execute function public.poke_push_dispatch();

-- 3. Cron fallback (only where pg_cron and pg_net exist) ----------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'luma-push-dispatch';
    perform cron.schedule('luma-push-dispatch', '* * * * *', $job$
      select net.http_post(url := s.function_url, body := '{}'::jsonb,
               headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', s.secret))
      from private.push_settings s
      where exists (select 1 from public.notifications n
                    where n.pushed_at is null and n.created_at > now() - interval '1 day')
    $job$);
  end if;
end;
$$;

-- 4. Claim a batch (service_role) ---------------------------------------------------------
create or replace function public.claim_push_batch(p_limit integer default 100)
returns table (notification_id uuid, type text, status text, order_id uuid,
               business_name text, tokens text[])
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with picked as (
    select n.id from public.notifications n
    where n.pushed_at is null and n.created_at > now() - interval '1 day'
    order by n.created_at
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
    for update skip locked
  ), marked as (
    update public.notifications n set pushed_at = now()
    from picked where n.id = picked.id
    returning n.id, n.user_id, n.type, n.status, n.order_id, n.business_id
  )
  select m.id, m.type, m.status, m.order_id,
         coalesce(o.business_name, b.name),
         array_agg(d.token order by d.last_seen_at desc)
  from marked m
  join public.profiles pr on pr.id = m.user_id
  join public.device_tokens d on d.user_id = m.user_id
  left join public.orders o on o.id = m.order_id
  left join public.businesses b on b.id = m.business_id
  where case m.type
          when 'promotion' then pr.notify_promotions
          when 'business_review' then true
          else pr.notify_orders
        end
  group by m.id, m.type, m.status, m.order_id, o.business_name, b.name;
end;
$$;

create or replace function public.remove_device_tokens(p_tokens text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.device_tokens where token = any (p_tokens);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.claim_push_batch(integer) from public, anon, authenticated;
revoke execute on function public.remove_device_tokens(text[]) from public, anon, authenticated;
grant execute on function public.claim_push_batch(integer) to service_role;
grant execute on function public.remove_device_tokens(text[]) to service_role;

notify pgrst, 'reload schema';
