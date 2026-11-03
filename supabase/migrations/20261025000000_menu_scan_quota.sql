-- -----------------------------------------------------------------------------
-- Migration: menu_scan_quota
-- Quota of the extract-menu Edge Function (photos of a menu read by a
-- multimodal model, returned as a draft the owner reviews).
--   1. ai_usage gains the scope 'menu_scan' (subject: the business).
--   2. consume_menu_scan_quota(business): only its owner with a confirmed
--      email; at most menu_scan_daily_per_business (5) scans a day per
--      business, and every scan also counts towards the caller's and the
--      global daily AI limits. Counted only when every limit has room.
-- Depends on 20261022000000_ai_gateway.sql.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

alter table public.ai_usage drop constraint if exists ai_usage_scope_valid;
alter table public.ai_usage
  add constraint ai_usage_scope_valid check (scope in ('user', 'business', 'global', 'menu_scan'));

insert into public.app_settings (key, int_value) values
  ('menu_scan_daily_per_business', 5)
on conflict (key) do nothing;

create or replace function public.consume_menu_scan_quota(p_business_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_day  date := (now() at time zone 'America/Bogota')::date;
  v_zero uuid := '00000000-0000-0000-0000-000000000000';
begin
  if v_user is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  if not public.is_email_confirmed() then
    raise exception using errcode = 'P0001', message = 'email_not_confirmed';
  end if;
  if p_business_id is null or not public.owns_business(p_business_id) then
    raise exception using errcode = '42501', message = 'not_business_owner';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ai_quota', 0));
  if coalesce((select calls from public.ai_usage
               where day = v_day and scope = 'menu_scan' and subject = p_business_id), 0)
     >= coalesce((select int_value from public.app_settings where key = 'menu_scan_daily_per_business'), 5)
  or coalesce((select calls from public.ai_usage
               where day = v_day and scope = 'user' and subject = v_user), 0)
     >= coalesce((select int_value from public.app_settings where key = 'ai_daily_per_user'), 20)
  or coalesce((select calls from public.ai_usage
               where day = v_day and scope = 'global' and subject = v_zero), 0)
     >= coalesce((select int_value from public.app_settings where key = 'ai_daily_global'), 500) then
    return false;
  end if;

  insert into public.ai_usage (day, scope, subject, calls)
  values (v_day, 'menu_scan', p_business_id, 1), (v_day, 'user', v_user, 1), (v_day, 'global', v_zero, 1)
  on conflict (day, scope, subject) do update set calls = public.ai_usage.calls + 1;
  return true;
end;
$$;

revoke execute on function public.consume_menu_scan_quota(uuid) from public, anon;
grant execute on function public.consume_menu_scan_quota(uuid) to authenticated;

notify pgrst, 'reload schema';
