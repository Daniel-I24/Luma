-- -----------------------------------------------------------------------------
-- Migration: business_signals
--   1. digits_only(text) (internal): compares NITs by their digits; phones are
--      compared as +57 mobiles when they are one (normalize_co_mobile).
--   2. submit_business_for_review: same signature and checks, and it refuses
--      with 'tax_id_in_use' when another user has a pending or approved
--      business with the same NIT.
--   3. business_review_flags(business): admin with aal2. Warning signs for the
--      review: duplicate_tax_id, duplicate_phone (phone or WhatsApp of a
--      business of another owner), near_duplicate_location (a business of
--      another owner within 50 m), similar_name (pg_trgm similarity >= 0.8 with an approved
--      business), the owner's account age and number of businesses.
-- Needs pg_trgm (Supabase installs it in the extensions schema).
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

create extension if not exists pg_trgm with schema extensions;

create or replace function public.digits_only(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$ select nullif(regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g'), '') $$;

revoke execute on function public.digits_only(text) from public, anon, authenticated;

-- Phone and WhatsApp of a business as comparable keys (+57 mobiles normalised).
create or replace function public.phone_keys(p_phone text, p_whatsapp text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(k), '{}') from unnest(array[
    coalesce(public.normalize_co_mobile(p_phone), public.digits_only(p_phone)),
    coalesce(public.normalize_co_mobile(p_whatsapp), public.digits_only(p_whatsapp))]) k
  where k is not null
$$;

revoke execute on function public.phone_keys(text, text) from public, anon, authenticated;

create or replace function public.tax_id_taken(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_legal mine
    join public.businesses b on b.id = mine.business_id
    join public.business_legal other on public.digits_only(other.tax_id) = public.digits_only(mine.tax_id)
    join public.businesses ob on ob.id = other.business_id
    where mine.business_id = p_business_id
      and ob.owner_id <> b.owner_id
      and ob.verification_status in ('pending', 'approved')
  )
$$;

revoke execute on function public.tax_id_taken(uuid) from public, anon, authenticated;

create or replace function public.business_review_flags(p_business_id uuid)
returns table (duplicate_tax_id boolean, duplicate_phone boolean, near_duplicate_location boolean,
               similar_name boolean, owner_account_age_days integer, owner_business_count integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  b public.businesses;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  select * into b from public.businesses where id = p_business_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'business_not_found';
  end if;
  return query
  select
    exists (select 1 from public.business_legal mine
            join public.business_legal other on public.digits_only(other.tax_id) = public.digits_only(mine.tax_id)
            join public.businesses ob on ob.id = other.business_id
            where mine.business_id = b.id and ob.id <> b.id),
    exists (select 1 from public.businesses ob
            where ob.owner_id <> b.owner_id
              and public.phone_keys(ob.phone, ob.whatsapp) && public.phone_keys(b.phone, b.whatsapp)),
    exists (select 1 from public.businesses ob
            where ob.owner_id <> b.owner_id and b.latitude is not null and ob.latitude is not null
              and 6371000 * 2 * asin(sqrt(power(sin(radians(ob.latitude - b.latitude) / 2), 2)
                    + cos(radians(b.latitude)) * cos(radians(ob.latitude))
                      * power(sin(radians(ob.longitude - b.longitude) / 2), 2))) < 50),
    exists (select 1 from public.businesses ob
            where ob.id <> b.id and ob.verification_status = 'approved'
              and extensions.similarity(lower(ob.name), lower(b.name)) >= 0.8),
    (select (current_date - u.created_at::date)::integer from auth.users u where u.id = b.owner_id),
    (select count(*)::integer from public.businesses ob where ob.owner_id = b.owner_id);
end;
$$;

revoke execute on function public.business_review_flags(uuid) from public, anon;
grant execute on function public.business_review_flags(uuid) to authenticated;

notify pgrst, 'reload schema';
