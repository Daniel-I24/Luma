-- -----------------------------------------------------------------------------
-- Migration: geocode_quota
-- Quota of the geocode Edge Function (map search of neighbourhoods,
-- addresses and places through an external geocoder).
--   1. ai_usage gains the scopes 'geocode' (subject: the user) and
--      'geocode_global' (subject: zero uuid).
--   2. consume_geocode_quota(): signed-in users only; at most
--      geocode_daily_per_user (200) and geocode_daily_global (5000) lookups a
--      day, which keeps the app inside the free plans and usage policies of
--      the providers. Counted only when both limits have room. Cached
--      answers do not call it (the function checks the cache first).
-- The 7-day cache TTL for geocode: keys is in ai_cache_put (20261022000000).
-- Depends on 20261022000000_ai_gateway.sql and 20261025000000_menu_scan_quota.sql.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

alter table public.ai_usage drop constraint if exists ai_usage_scope_valid;
alter table public.ai_usage
  add constraint ai_usage_scope_valid
    check (scope in ('user', 'business', 'global', 'menu_scan', 'geocode', 'geocode_global'));

insert into public.app_settings (key, int_value) values
  ('geocode_daily_per_user', 200),
  ('geocode_daily_global', 5000)
on conflict (key) do nothing;

-- Search is not a write: an unconfirmed email may still look up places.
create or replace function public.consume_geocode_quota()
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
  perform pg_advisory_xact_lock(hashtextextended('geocode_quota', 0));
  if coalesce((select calls from public.ai_usage
               where day = v_day and scope = 'geocode' and subject = v_user), 0)
     >= coalesce((select int_value from public.app_settings where key = 'geocode_daily_per_user'), 200)
  or coalesce((select calls from public.ai_usage
               where day = v_day and scope = 'geocode_global' and subject = v_zero), 0)
     >= coalesce((select int_value from public.app_settings where key = 'geocode_daily_global'), 5000) then
    return false;
  end if;

  insert into public.ai_usage (day, scope, subject, calls)
  values (v_day, 'geocode', v_user, 1), (v_day, 'geocode_global', v_zero, 1)
  on conflict (day, scope, subject) do update set calls = public.ai_usage.calls + 1;
  return true;
end;
$$;

revoke execute on function public.consume_geocode_quota() from public, anon;
grant execute on function public.consume_geocode_quota() to authenticated;

notify pgrst, 'reload schema';
