-- -----------------------------------------------------------------------------
-- Migration: push_server_status (pending review).
-- admin_push_health read the last row of net._http_response, and that table also
-- holds the answers of the payments cron: the panel could show another function's
-- status. Now each call to push-dispatch records its pg_net request id.
--   1. private.push_requests: the ids, kept one day.
--   2. poke_push_dispatch and the cron job record the id of their call.
--   3. admin_push_health: only those answers, with their time and any network error.
-- Same grants. Without pg_cron or pg_net nothing is recorded and no call is made.
-- -----------------------------------------------------------------------------

create table private.push_requests (
  request_id bigint      not null constraint push_requests_pkey primary key,
  created_at timestamptz not null default now()
);
revoke all on private.push_requests from public, anon, authenticated;

create or replace function public.poke_push_dispatch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings record;
  v_request bigint;
begin
  if to_regnamespace('net') is null then
    return null;
  end if;
  select function_url, secret into v_settings from private.push_settings where id;
  if not found then
    return null;
  end if;
  begin
    execute 'select net.http_post(url := $1, body := $2, headers := $3)' into v_request
      using v_settings.function_url, '{}'::jsonb,
            jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_settings.secret);
    insert into private.push_requests (request_id) values (v_request);
  exception when others then
    -- The notification is saved anyway; the cron fallback sends it.
    null;
  end;
  return null;
end;
$$;

revoke execute on function public.poke_push_dispatch() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'luma-push-dispatch';
    perform cron.schedule('luma-push-dispatch', '* * * * *', $job$
      with old as (
        delete from private.push_requests where created_at < now() - interval '1 day'
      )
      insert into private.push_requests (request_id)
      select net.http_post(url := s.function_url, body := '{}'::jsonb,
               headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', s.secret))
      from private.push_settings s
      where private.push_work_pending()
    $job$);
  end if;
end;
$$;

create or replace function public.admin_push_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_last jsonb;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  -- pg_net is optional, so its table is read only when it exists.
  if to_regclass('net._http_response') is not null then
    execute $query$
      select jsonb_build_object('status', r.status_code, 'body', left(r.content::text, 300),
                                'at', r.created, 'error', left(r.error_msg, 120))
      from net._http_response r
      join private.push_requests q on q.request_id = r.id
      order by r.created desc limit 1
    $query$ into v_last;
  end if;
  return coalesce(v_last, '{}'::jsonb) || jsonb_build_object(
    'tokens', (select count(*) from public.device_tokens),
    'unsent', (select count(*) from public.notifications n where n.pushed_at is null),
    'retrying', (select count(*) from private.push_retries)
  );
end;
$$;

revoke execute on function public.admin_push_health() from public, anon;
grant execute on function public.admin_push_health() to authenticated;

notify pgrst, 'reload schema';
