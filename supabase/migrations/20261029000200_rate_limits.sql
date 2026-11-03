-- -----------------------------------------------------------------------------
-- Migration: rate_limits
-- Per-user request rate limits for Edge Functions, checked before any costly
-- work (decoding images, calling a provider). Quotas (ai_usage) still count
-- model calls; this counts requests, including those that fail later.
--   1. rate_limit_hits: closed table (no client grants), one row per bucket,
--      user and fixed window.
--   2. app_settings rate_<bucket>_max and rate_<bucket>_window_seconds define
--      each bucket; a bucket without both settings does not exist.
--   3. hit_rate_limit(bucket): the caller (confirmed email) spends one hit of
--      their own bucket; false once the window is full. Old windows of the
--      caller are deleted on the way.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

create table if not exists public.rate_limit_hits (
  bucket       text        not null constraint rate_limit_hits_bucket_shape check (bucket ~ '^[a-z_]{1,40}$'),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  hits         integer     not null default 1 constraint rate_limit_hits_positive check (hits > 0),
  constraint rate_limit_hits_pkey primary key (bucket, user_id, window_start)
);

alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from public, anon, authenticated;

insert into public.app_settings (key, int_value) values
  ('rate_menu_scan_max', 6),
  ('rate_menu_scan_window_seconds', 600)
on conflict (key) do nothing;

create or replace function public.hit_rate_limit(p_bucket text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_max    integer;
  v_window integer;
  v_start  timestamptz;
  v_hits   integer;
begin
  if v_user is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  if not public.is_email_confirmed() then
    raise exception using errcode = 'P0001', message = 'email_not_confirmed';
  end if;
  select int_value into v_max from public.app_settings where key = 'rate_' || p_bucket || '_max';
  select int_value into v_window from public.app_settings where key = 'rate_' || p_bucket || '_window_seconds';
  if p_bucket !~ '^[a-z_]{1,40}$' or v_max is null or v_window is null or v_window < 1 then
    raise exception using errcode = '22023', message = 'unknown_rate_limit';
  end if;
  v_start := to_timestamp(floor(extract(epoch from now()) / v_window) * v_window);

  delete from public.rate_limit_hits
  where user_id = v_user and bucket = p_bucket and window_start < v_start;
  insert into public.rate_limit_hits (bucket, user_id, window_start)
  values (p_bucket, v_user, v_start)
  on conflict (bucket, user_id, window_start)
    do update set hits = public.rate_limit_hits.hits + 1
  returning hits into v_hits;
  return v_hits <= v_max;
end;
$$;

revoke execute on function public.hit_rate_limit(text) from public, anon;
grant execute on function public.hit_rate_limit(text) to authenticated;

notify pgrst, 'reload schema';
