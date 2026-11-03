-- -----------------------------------------------------------------------------
-- Migration: round1_hardening
-- Fixes found while reviewing round 1 (functions redefined with the same
-- signatures and grants):
--   1. notify_promotion tells at most promotion_notify_max_recipients (500)
--      users, the most recent favourites first.
--   2. handle_new_user reads the consent flags with CASE: Postgres does not
--      promise to evaluate AND left to right, so "x"::boolean could raise in
--      DECLARE, outside the exception block, and abort the sign-up.
--   3. register_device_token needs a confirmed email, like every other write.
-- Depends on 20261019000000_account_types.sql and 20261027000000_push_notifications.sql.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

insert into public.app_settings (key, int_value) values ('promotion_notify_max_recipients', 500)
on conflict (key) do nothing;

-- 1. notify_promotion ------------------------------------------------------------------
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
  where f.business_id = v_business and pr.notify_promotions and f.user_id <> b.owner_id
  order by f.created_at desc
  limit coalesce((select int_value from public.app_settings where key = 'promotion_notify_max_recipients'), 500);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.notify_promotion(uuid) from public, anon;
grant execute on function public.notify_promotion(uuid) to authenticated;

-- 2. handle_new_user ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := case when jsonb_typeof(new.raw_user_meta_data) = 'object'
                       then new.raw_user_meta_data else '{}'::jsonb end;
  v_type text := case when v_meta ->> 'account_type' = 'business_owner'
                      then 'business_owner' else 'customer' end;
  v_name text := case when jsonb_typeof(v_meta -> 'full_name') = 'string'
                      then nullif(btrim(v_meta ->> 'full_name'), '') end;
  -- Each consent is recorded only when its own flag is the JSON boolean true;
  -- comparing jsonb values never casts, so no input can raise here.
  v_terms boolean := case when v_meta -> 'accepted_terms' = 'true'::jsonb then true else false end;
  v_privacy boolean := case when v_meta -> 'accepted_privacy' = 'true'::jsonb then true else false end;
  v_age boolean := case when v_meta -> 'confirmed_age' = 'true'::jsonb then true else false end;
begin
  if char_length(v_name) > 80 then
    v_name := null;
  end if;
  begin
    insert into public.profiles (id, email, account_type, full_name, phone,
                                 terms_accepted_at, terms_version, privacy_accepted_at,
                                 privacy_version, age_confirmed_at)
    values (new.id, new.email, v_type, v_name, public.normalize_co_mobile(v_meta ->> 'phone'),
            case when v_terms then now() end,
            case when v_terms then left(v_meta ->> 'terms_version', 20) end,
            case when v_privacy then now() end,
            case when v_privacy then left(v_meta ->> 'privacy_version', 20) end,
            case when v_age then now() end);
  exception when others then
    -- Never block a sign-up: fall back to the bare profile.
    insert into public.profiles (id, email) values (new.id, new.email)
    on conflict (id) do nothing;
  end;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 3. register_device_token ---------------------------------------------------------------
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
  if not public.is_email_confirmed() then
    raise exception using errcode = 'P0001', message = 'email_not_confirmed';
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

revoke execute on function public.register_device_token(text, text) from public, anon;
grant execute on function public.register_device_token(text, text) to authenticated;

notify pgrst, 'reload schema';
