-- -----------------------------------------------------------------------------
-- Migration: account_types
-- Account type and private profile data. NOT APPLIED YET: review first.
--
--   - profiles gets account_type ('customer' | 'business_owner'), full_name
--     and phone (private: only the user reads them; no public or business
--     view exposes them), consented_at and terms_version (set by the server
--     from the sign-up metadata) and onboarding_seen_version.
--   - handle_new_user copies and validates the sign-up metadata. It never
--     blocks a sign-up: anything invalid is ignored and safe defaults apply.
--   - Clients may update only display_name, full_name, phone and
--     onboarding_seen_version. account_type changes only through
--     become_business_owner() (customer -> business_owner, never back).
--   - Only business_owner accounts create businesses, at most
--     app_settings.max_businesses_per_owner (3) each.
-- -----------------------------------------------------------------------------

-- 1. Columns --------------------------------------------------------------------
alter table public.profiles
  add column if not exists account_type text not null default 'customer'
    constraint profiles_account_type_valid check (account_type in ('customer', 'business_owner')),
  add column if not exists full_name text
    constraint profiles_full_name_length check (full_name is null or char_length(btrim(full_name)) between 1 and 80),
  add column if not exists phone text
    constraint profiles_phone_co_mobile check (phone is null or phone ~ '^\+573[0-9]{9}$'),
  add column if not exists consented_at timestamptz,
  add column if not exists terms_version text
    constraint profiles_terms_version_length check (terms_version is null or char_length(terms_version) <= 20),
  add column if not exists onboarding_seen_version smallint not null default 0
    constraint profiles_onboarding_version_range check (onboarding_seen_version between 0 and 1000);

comment on column public.profiles.full_name is 'Private: only the user reads it.';
comment on column public.profiles.phone is 'Private Colombian mobile in E.164 (+573XXXXXXXXX).';

-- Accounts that already own a business are business owners.
update public.profiles p set account_type = 'business_owner'
where exists (select 1 from public.businesses b where b.owner_id = p.id);

insert into public.app_settings (key, int_value) values ('max_businesses_per_owner', 3)
on conflict (key) do nothing;

-- 2. Colombian mobile numbers ----------------------------------------------------
-- "+57 300 123 4567", "3001234567", "573001234567" -> "+573001234567"; NULL if invalid.
create or replace function public.normalize_co_mobile(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when d ~ '^3[0-9]{9}$' then '+57' || d
    when d ~ '^573[0-9]{9}$' then '+' || d
    else null
  end
  from (select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as d) digits
$$;

revoke execute on function public.normalize_co_mobile(text) from public, anon;
grant execute on function public.normalize_co_mobile(text) to authenticated;

-- 3. Profile from the sign-up metadata -------------------------------------------
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
  v_name text := nullif(btrim(v_meta ->> 'full_name'), '');
  v_consent boolean := jsonb_typeof(v_meta -> 'accepted_terms') = 'boolean'
                       and (v_meta ->> 'accepted_terms')::boolean;
begin
  if char_length(v_name) > 80 then
    v_name := null;
  end if;
  begin
    insert into public.profiles (id, email, account_type, full_name, phone, consented_at, terms_version)
    values (new.id, new.email, v_type, v_name, public.normalize_co_mobile(v_meta ->> 'phone'),
            case when v_consent then now() end,
            case when v_consent then left(v_meta ->> 'terms_version', 20) end);
  exception when others then
    -- Never block a sign-up: fall back to the bare profile.
    insert into public.profiles (id, email) values (new.id, new.email)
    on conflict (id) do nothing;
  end;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 4. Column privileges -----------------------------------------------------------
revoke update on public.profiles from authenticated;
grant update (display_name, full_name, phone, onboarding_seen_version) on public.profiles to authenticated;

-- 5. Customer -> business owner (one way) ---------------------------------------
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
  update public.profiles set account_type = 'business_owner'
  where id = auth.uid() and account_type = 'customer';
  select p.account_type into v_type from public.profiles p where p.id = auth.uid();
  return v_type;
end;
$$;

revoke execute on function public.become_business_owner() from public, anon;
grant execute on function public.become_business_owner() to authenticated;

-- 6. Who may create businesses ---------------------------------------------------
create or replace function public.businesses_owner_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- SECURITY DEFINER: current_user is the owner here, so the API role comes
  -- from the (signed) JWT claims; the SQL editor and seeds have none.
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '')
     not in ('anon', 'authenticated') then
    return new;
  end if;
  if not exists (select 1 from public.profiles p
                 where p.id = new.owner_id and p.account_type = 'business_owner') then
    raise exception using errcode = 'P0001', message = 'not_business_owner';
  end if;
  -- One creation at a time per owner so the limit holds.
  perform pg_advisory_xact_lock(hashtextextended('businesses:' || new.owner_id::text, 0));
  if (select count(*) from public.businesses b where b.owner_id = new.owner_id)
     >= coalesce((select s.int_value from public.app_settings s where s.key = 'max_businesses_per_owner'), 3) then
    raise exception using errcode = 'P0001', message = 'business_limit_reached';
  end if;
  return new;
end;
$$;

revoke execute on function public.businesses_owner_limits() from public, anon, authenticated;

drop trigger if exists businesses_owner_limits on public.businesses;
create trigger businesses_owner_limits
  before insert on public.businesses
  for each row execute procedure public.businesses_owner_limits();

notify pgrst, 'reload schema';
