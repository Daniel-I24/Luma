-- -----------------------------------------------------------------------------
-- Migration: customer_profile
-- Who orders: residence, an optional photo, and what "complete" means.
--   1. profiles: residence_department, residence_city, residence_dane_code
--      (DANE municipality code, five digits), residence_neighborhood
--      (optional, up to 60), avatar_path, avatar_consent_at and
--      show_avatar_to_business (off by default). The user edits residence
--      and the sharing flag; avatar_path and its consent only through
--      set_avatar (20261030000110_avatars.sql).
--   2. is_profile_complete(): the caller has a full name, a valid Colombian
--      mobile and a residence municipality. create_order requires it.
--   3. is_phone_verified(): auth.users.phone_confirmed_at is set and the
--      verified phone is the profile phone. Only required when
--      app_settings.require_phone_verification = 1 (0 by default; Supabase
--      Phone Auth needs an SMS provider, docs/security.md).
--   4. become_business_owner: same signature; also needs a complete profile
--      and, when required, a verified phone.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists residence_department text
    constraint profiles_residence_department_length
      check (residence_department is null or char_length(btrim(residence_department)) between 2 and 60),
  add column if not exists residence_city text
    constraint profiles_residence_city_length
      check (residence_city is null or char_length(btrim(residence_city)) between 2 and 80),
  add column if not exists residence_dane_code text
    constraint profiles_residence_dane_code_shape check (residence_dane_code is null or residence_dane_code ~ '^[0-9]{5}$'),
  add column if not exists residence_neighborhood text
    constraint profiles_residence_neighborhood_length
      check (residence_neighborhood is null or char_length(btrim(residence_neighborhood)) between 1 and 60),
  add column if not exists avatar_path text,
  add column if not exists avatar_consent_at timestamptz,
  add column if not exists show_avatar_to_business boolean not null default false,
  add column if not exists strikes_cleared_at timestamptz;

alter table public.profiles
  add constraint profiles_residence_together check (
    (residence_dane_code is null and residence_city is null and residence_department is null)
    or (residence_dane_code is not null and residence_city is not null and residence_department is not null)),
  add constraint profiles_avatar_path_shape check (
    avatar_path is null
    or avatar_path ~ ('^' || id::text || '/avatar/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}\.(jpg|png|webp)$')),
  add constraint profiles_avatar_needs_consent check (avatar_path is null or avatar_consent_at is not null);

comment on column public.profiles.residence_dane_code is 'Private: DANE code of the municipality of residence.';
comment on column public.profiles.avatar_path is 'Private avatars bucket object; set only by set_avatar.';
comment on column public.profiles.strikes_cleared_at is 'No-show strikes before this time do not count (admin_clear_strikes).';

grant update (residence_department, residence_city, residence_dane_code, residence_neighborhood,
              show_avatar_to_business)
  on public.profiles to authenticated;

insert into public.app_settings (key, int_value) values ('require_phone_verification', 0)
on conflict (key) do nothing;

-- 2. Complete profile ------------------------------------------------------------------
create or replace function public.is_profile_complete()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.full_name is not null and char_length(btrim(p.full_name)) >= 3
      and p.phone ~ '^\+573[0-9]{9}$'
      and p.residence_dane_code is not null
  )
$$;

revoke execute on function public.is_profile_complete() from public, anon;
grant execute on function public.is_profile_complete() to authenticated;

-- 3. Verified phone ----------------------------------------------------------------------
create or replace function public.is_phone_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = (select auth.uid())
      and u.phone_confirmed_at is not null
      and p.phone = '+' || regexp_replace(coalesce(u.phone, ''), '[^0-9]', '', 'g')
  )
$$;

revoke execute on function public.is_phone_verified() from public, anon;
grant execute on function public.is_phone_verified() to authenticated;

-- True when the phone check is off, or the caller passed it.
create or replace function public.phone_check_passed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.int_value from public.app_settings s where s.key = 'require_phone_verification'), 0) = 0
      or public.is_phone_verified()
$$;

revoke execute on function public.phone_check_passed() from public, anon;
grant execute on function public.phone_check_passed() to authenticated;

-- 4. Owners need a complete profile too -----------------------------------------------
create or replace function public.become_business_owner()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  if not public.is_email_confirmed() then
    raise exception using errcode = 'P0001', message = 'email_not_confirmed';
  end if;
  if not public.is_profile_complete() then
    raise exception using errcode = 'P0001', message = 'profile_incomplete';
  end if;
  if not public.phone_check_passed() then
    raise exception using errcode = 'P0001', message = 'phone_not_verified';
  end if;
  update public.profiles set account_type = 'business_owner'
  where id = auth.uid() and account_type = 'customer';
  select p.account_type into v_type from public.profiles p where p.id = auth.uid();
  return v_type;
end;
$$;

revoke execute on function public.become_business_owner() from public, anon;
grant execute on function public.become_business_owner() to authenticated;

notify pgrst, 'reload schema';
