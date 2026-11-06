-- -----------------------------------------------------------------------------
-- Migration: push_test_answer (pending review).
-- The phone test failed in silence twice: push-dispatch answered 404 to every
-- poke, and the admin's account had no device token. Neither reached a screen.
--   1. send_test_notification answers whether the account has a device token
--      (return type changes: drop and create, same arguments and grants).
--   2. admin_push_health(): for the admin panel, the last pg_net answer (the
--      status of the function, and its counts and FCM reasons), and how many
--      tokens and unsent notices exist. Admins with aal2 only; no personal data.
-- -----------------------------------------------------------------------------

drop function public.send_test_notification();

create function public.send_test_notification()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  if not public.hit_rate_limit('push_test') then
    raise exception using errcode = 'P0001', message = 'rate_limited';
  end if;
  insert into public.notifications (user_id, type) values (auth.uid(), 'test');
  return exists (select 1 from public.device_tokens t where t.user_id = auth.uid());
end;
$$;

revoke execute on function public.send_test_notification() from public, anon;
grant execute on function public.send_test_notification() to authenticated;

create function public.admin_push_health()
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
      select jsonb_build_object('status', r.status_code, 'body', left(r.content::text, 300), 'at', r.created)
      from net._http_response r order by r.created desc limit 1
    $query$ into v_last;
  end if;
  return coalesce(v_last, '{}'::jsonb) || jsonb_build_object(
    'tokens', (select count(*) from public.device_tokens),
    'unsent', (select count(*) from public.notifications n where n.pushed_at is null)
  );
end;
$$;

revoke execute on function public.admin_push_health() from public, anon;
grant execute on function public.admin_push_health() to authenticated;

notify pgrst, 'reload schema';
