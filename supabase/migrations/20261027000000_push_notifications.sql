-- -----------------------------------------------------------------------------
-- Migration: push_notifications
-- Phone notifications (FCM) on top of the in-app notifications table.
--   1. device_tokens: closed table (no client grants); written only through
--      register_device_token / unregister_device_token. At most 10 per user;
--      a token used by another account moves to the caller (shared phone).
--   2. profiles.notify_orders (default on) and notify_promotions (default
--      off: marketing needs explicit consent, Ley 1581).
--   3. notifications: type 'promotion' (+ promotion_id) and pushed_at.
--   4. notify_promotion(promotion): the owner of a public business tells the
--      users who saved it as favourite and accepted promotions. Once per
--      promotion, at most promotion_notify_daily_per_business (1) a day,
--      only while the promotion is running. Returns the recipients.
--   Dispatch (pg_net, pg_cron, claim_push_batch) is in 20261027000100_push_dispatch.sql.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

-- 1. Device tokens -------------------------------------------------------------------
create table if not exists public.device_tokens (
  token        text        not null constraint device_tokens_token_shape
    check (char_length(token) between 20 and 4096 and token ~ '^[A-Za-z0-9:_.-]+$'),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  platform     text        not null constraint device_tokens_platform_valid check (platform in ('android', 'web')),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint device_tokens_pkey primary key (token)
);

create index if not exists device_tokens_user_idx on public.device_tokens (user_id, last_seen_at desc);
alter table public.device_tokens enable row level security;
revoke all on public.device_tokens from public, anon, authenticated;

create or replace function public.register_device_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  insert into public.device_tokens (token, user_id, platform)
  values (p_token, v_user, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = now();
  delete from public.device_tokens d
  where d.user_id = v_user
    and d.token not in (select t.token from public.device_tokens t
                        where t.user_id = v_user order by t.last_seen_at desc limit 10);
end;
$$;

create or replace function public.unregister_device_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.device_tokens where token = p_token and user_id = auth.uid()
$$;

revoke execute on function public.register_device_token(text, text) from public, anon;
revoke execute on function public.unregister_device_token(text) from public, anon;
grant execute on function public.register_device_token(text, text) to authenticated;
grant execute on function public.unregister_device_token(text) to authenticated;

-- 2. Preferences -----------------------------------------------------------------------
alter table public.profiles
  add column if not exists notify_orders boolean not null default true,
  add column if not exists notify_promotions boolean not null default false;
grant update (notify_orders, notify_promotions) on public.profiles to authenticated;

-- 3. Notifications ---------------------------------------------------------------------
alter table public.notifications
  add column if not exists promotion_id uuid references public.promotions (id) on delete cascade,
  add column if not exists pushed_at timestamptz;
alter table public.notifications drop constraint if exists notifications_type_valid;
alter table public.notifications add constraint notifications_type_valid
  check (type in ('order_status', 'order_new', 'order_cancelled', 'business_review', 'promotion'));
create index if not exists notifications_unpushed_idx on public.notifications (created_at) where pushed_at is null;

alter table public.promotions add column if not exists notified_at timestamptz;

insert into public.app_settings (key, int_value) values
  ('promotion_notify_daily_per_business', 1)
on conflict (key) do nothing;

-- 4. notify_promotion ----------------------------------------------------------------
create or replace function public.notify_promotion(p_promotion_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_count    integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  if not public.is_email_confirmed() then
    raise exception using errcode = 'P0001', message = 'email_not_confirmed';
  end if;
  select p.business_id into v_business from public.promotions p where p.id = p_promotion_id for update;
  if v_business is null or not public.owns_business(v_business) then
    raise exception using errcode = '42501', message = 'not_business_owner';
  end if;
  if not public.is_business_public(v_business) then
    raise exception using errcode = 'P0001', message = 'business_not_public';
  end if;
  if not exists (select 1 from public.promotions p
                 where p.id = p_promotion_id and p.is_active and p.starts_at <= now() and p.ends_at > now()) then
    raise exception using errcode = 'P0001', message = 'promotion_not_running';
  end if;
  if exists (select 1 from public.promotions p where p.id = p_promotion_id and p.notified_at is not null) then
    raise exception using errcode = 'P0001', message = 'already_notified';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('notify_promotion:' || v_business::text, 0));
  if (select count(*) from public.promotions p
      where p.business_id = v_business and p.notified_at > now() - interval '1 day')
     >= coalesce((select int_value from public.app_settings where key = 'promotion_notify_daily_per_business'), 1) then
    raise exception using errcode = 'P0001', message = 'notify_limit';
  end if;

  update public.promotions set notified_at = now() where id = p_promotion_id;
  insert into public.notifications (user_id, type, business_id, promotion_id)
  select f.user_id, 'promotion', v_business, p_promotion_id
  from public.favorites f
  join public.profiles pr on pr.id = f.user_id
  join public.businesses b on b.id = f.business_id
  where f.business_id = v_business and pr.notify_promotions and f.user_id <> b.owner_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.notify_promotion(uuid) from public, anon;
grant execute on function public.notify_promotion(uuid) to authenticated;

notify pgrst, 'reload schema';
