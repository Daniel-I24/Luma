-- -----------------------------------------------------------------------------
-- Phone verification, still free and off by default (docs/phone-verification.md).
--   1. submit_business_for_review also requires phone_check_passed(), like
--      create_order and become_business_owner (raises 'phone_not_verified'
--      only while app_settings.require_phone_verification = 1).
--   2. profiles_phone_guard: while the requirement is on, a user can change
--      profiles.phone only to the phone confirmed in auth.users (the
--      verification flow). Off: nothing changes. SQL without a user
--      (migrations, dashboard, service role) is not restricted.
--   3. sync_verified_phone(): copies the confirmed auth phone to the profile
--      after the code check (auth.verifyOtp type 'phone_change').
-- Signature and grants of submit_business_for_review are kept.
-- -----------------------------------------------------------------------------

-- 1. Submit for review ------------------------------------------------------------
create or replace function public.submit_business_for_review(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.businesses;
  v_missing text[] := '{}';
begin
  if not public.is_email_confirmed() then
    raise exception using errcode = 'P0001', message = 'email_not_confirmed';
  end if;
  -- Same rule as create_order and become_business_owner (off by default).
  if not public.phone_check_passed() then
    raise exception using errcode = 'P0001', message = 'phone_not_verified';
  end if;
  select * into b from public.businesses
  where id = p_business_id and owner_id = (select auth.uid())
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'business_not_found';
  end if;
  if b.verification_status not in ('draft', 'rejected') then
    raise exception using errcode = 'P0001', message = 'not_submittable';
  end if;
  if public.tax_id_taken(b.id) then
    raise exception using errcode = 'P0001', message = 'tax_id_in_use';
  end if;
  if char_length(btrim(b.name)) < 2 then v_missing := array_append(v_missing, 'name'); end if;
  if b.category is null or btrim(b.category) = '' then v_missing := array_append(v_missing, 'category'); end if;
  if char_length(btrim(b.address)) < 5 then v_missing := array_append(v_missing, 'address'); end if;
  if b.latitude is null or b.longitude is null or (b.latitude = 0 and b.longitude = 0) then
    v_missing := array_append(v_missing, 'location');
  end if;
  if b.phone is null then v_missing := array_append(v_missing, 'phone'); end if;
  if not exists (select 1 from public.business_hours h where h.business_id = b.id and not h.is_closed) then
    v_missing := array_append(v_missing, 'open_day');
  end if;
  if not exists (select 1 from public.menu_items m where m.business_id = b.id and m.is_available) then
    v_missing := array_append(v_missing, 'available_item');
  end if;
  if not exists (select 1 from public.business_legal l where l.business_id = b.id) then
    v_missing := array_append(v_missing, 'legal');
  end if;
  if not exists (select 1 from public.business_verification_docs d where d.business_id = b.id and d.kind = 'rut') then
    v_missing := array_append(v_missing, 'doc_rut');
  end if;
  if not exists (select 1 from public.business_verification_docs d where d.business_id = b.id and d.kind = 'facade') then
    v_missing := array_append(v_missing, 'doc_facade');
  end if;
  if cardinality(v_missing) = 0 then
    update public.businesses set verification_status = 'pending', verification_note = null where id = b.id;
  end if;
  return jsonb_build_object('ok', cardinality(v_missing) = 0, 'missing', to_jsonb(v_missing));
end;
$$;

revoke execute on function public.submit_business_for_review(uuid) from public, anon;
grant execute on function public.submit_business_for_review(uuid) to authenticated;

-- 2. Phone guard ------------------------------------------------------------------
create or replace function public.verified_auth_phone()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select '+' || regexp_replace(u.phone, '[^0-9]', '', 'g')
  from auth.users u
  where u.id = (select auth.uid()) and u.phone_confirmed_at is not null and coalesce(u.phone, '') <> ''
$$;

revoke execute on function public.verified_auth_phone() from public, anon;
grant execute on function public.verified_auth_phone() to authenticated;

create or replace function private.profiles_phone_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or new.phone is not distinct from old.phone then
    return new;
  end if;
  if coalesce((select s.int_value from public.app_settings s where s.key = 'require_phone_verification'), 0) = 1
     and new.phone is distinct from public.verified_auth_phone() then
    raise exception using errcode = 'P0001', message = 'phone_not_verified';
  end if;
  return new;
end;
$$;

revoke execute on function private.profiles_phone_guard() from public, anon, authenticated;

drop trigger if exists profiles_phone_guard on public.profiles;
create trigger profiles_phone_guard
  before update of phone on public.profiles
  for each row execute function private.profiles_phone_guard();

-- 3. Copy the verified phone ------------------------------------------------------
create or replace function public.sync_verified_phone()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := public.verified_auth_phone();
begin
  if v_phone is null or v_phone !~ '^\+573[0-9]{9}$' then
    raise exception using errcode = 'P0001', message = 'phone_not_verified';
  end if;
  update public.profiles set phone = v_phone where id = (select auth.uid());
  return v_phone;
end;
$$;

revoke execute on function public.sync_verified_phone() from public, anon;
grant execute on function public.sync_verified_phone() to authenticated;

notify pgrst, 'reload schema';
