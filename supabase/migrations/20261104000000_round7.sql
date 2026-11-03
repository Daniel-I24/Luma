-- -----------------------------------------------------------------------------
-- Migration: round7 (pending review, depends on 20261103000000_round6)
--   1. Businesses per owner: still app_settings.max_businesses_per_owner (3)
--      counting every business of the owner in any state, under a per-owner
--      advisory lock, plus a daily limit of creations (hit_rate_limit
--      'business_create', 3 a day) so deleting and creating again does not
--      get around it. Owners above the limit keep what they have and cannot
--      add more.
--   2. Validation rules as private SQL functions, the same as
--      src/app/core/validation (shared vectors in
--      supabase/tests/fixtures/validation_vectors.json). Letters are checked
--      with [[:alpha:]] under the ICU collation "und-x-icu": under the "C"
--      collation Postgres only sees ASCII letters (docs/validation-matrix.md).
--   3. CHECK constraints NOT VALID on what clients write (new and updated rows
--      are checked; docs/data-quality.sql lists the old rows to fix before
--      VALIDATE). The discount range becomes 1-90.
--   4. handle_new_user stores the sign-up name cleaned, or none when it breaks
--      the rule; order notes are cleaned on the server; an unchanged phone
--      written in another format keeps its verification.
--   5. From the review of 52 and 53: owners read contact_verifications
--      without verified_by; the daily request limit counts per kind and
--      business; a new request voids the pending ones of its kind.
-- NOT APPLIED YET. SQL comments in ASCII.
-- -----------------------------------------------------------------------------

-- 1. Businesses per owner -------------------------------------------------------------
insert into public.app_settings (key, int_value) values
  ('max_businesses_per_owner', 3),
  ('rate_business_create_max', 3),
  ('rate_business_create_window_seconds', 86400)
on conflict (key) do nothing;

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
  if not public.is_email_confirmed() then
    raise exception using errcode = 'P0001', message = 'email_not_confirmed';
  end if;
  if not exists (select 1 from public.profiles p
                 where p.id = new.owner_id and p.account_type = 'business_owner') then
    raise exception using errcode = 'P0001', message = 'not_business_owner';
  end if;
  -- One creation at a time per owner: two simultaneous inserts wait here,
  -- so the second one counts the first.
  perform pg_advisory_xact_lock(hashtextextended('businesses:' || new.owner_id::text, 0));
  if (select count(*) from public.businesses b where b.owner_id = new.owner_id)
     >= coalesce((select s.int_value from public.app_settings s where s.key = 'max_businesses_per_owner'), 3) then
    raise exception using errcode = 'P0001', message = 'business_limit_reached';
  end if;
  -- Creations a day, whatever was deleted since (rolled back with a failed insert).
  if not public.hit_rate_limit('business_create') then
    raise exception using errcode = 'P0001', message = 'business_daily_limit';
  end if;
  return new;
end;
$$;

revoke execute on function public.businesses_owner_limits() from public, anon, authenticated;

-- 2. Validation rules ---------------------------------------------------------------
-- What a text field stores: control, zero-width, BOM and direction characters
-- removed, spaces collapsed (multi-line: lines kept, at most one empty line),
-- trimmed, NFC. Same steps as TextNormalizer (src/app/core/validation).
create or replace function private.clean_text(p_value text, p_multiline boolean default false)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select normalize(
    case when p_multiline then
      btrim(regexp_replace(regexp_replace(
        regexp_replace(s, '[\t\v\f \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+', ' ', 'g'),
        ' ?\n ?', E'\n', 'g'), '\n{3,}', E'\n\n', 'g'), E' \n')
    else
      btrim(regexp_replace(s, '[\t\n\v\f \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+', ' ', 'g'), ' ')
    end, nfc)
  from (select regexp_replace(regexp_replace(p_value, '\r\n?', E'\n', 'g'),
    '[\u0001-\u0008\u000E-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]', '', 'g') as s) t
$$;

-- Already stored as clean_text would leave it, with min..max characters.
create or replace function private.is_clean_text(p_value text, p_min integer, p_max integer, p_multiline boolean default false)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select p_value is not null
     and p_value = private.clean_text(p_value, p_multiline)
     and char_length(p_value) between p_min and p_max
$$;

-- Clean, min..max, with at least one letter (or, p_digits, a letter or a digit).
create or replace function private.is_text_line(p_value text, p_min integer, p_max integer, p_digits boolean default false)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select private.is_clean_text(p_value, p_min, p_max)
     and (p_value collate "und-x-icu") ~ case when p_digits then '[[:alpha:][:digit:]]' else '[[:alpha:]]' end
$$;

-- Person: letters, spaces, apostrophes, hyphen and dot; starts with a letter; two letters at least.
create or replace function private.is_person_name(p_value text, p_max integer default 60)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select private.is_clean_text(p_value, 2, p_max)
     and (p_value collate "und-x-icu") ~ '^[[:alpha:]][[:alpha:] ''\u2019.-]*$'
     and char_length(regexp_replace(p_value collate "und-x-icu", '[^[:alpha:]]', '', 'g')) >= 2
$$;

-- Business: letters, digits, spaces and & ' - . , ( ); one letter at least.
create or replace function private.is_business_name(p_value text, p_max integer default 60)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select private.is_clean_text(p_value, 2, p_max)
     and (p_value collate "und-x-icu") ~ '^[[:alpha:][:digit:] &''\u2019.,()-]+$'
     and (p_value collate "und-x-icu") ~ '[[:alpha:]]'
$$;

-- Address: 5 to 120 characters with letters and a number.
create or replace function private.is_address(p_value text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select private.is_clean_text(p_value, 5, 120)
     and (p_value collate "und-x-icu") ~ '^[[:alpha:][:digit:] #.,/\u00B0\u00BA()''\u2019-]+$'
     and (p_value collate "und-x-icu") ~ '[[:alpha:]]'
     and p_value ~ '[0-9]'
$$;

-- Colombian mobile (3XXXXXXXXX) or landline (60 + area 1-8 + 7 digits) as +57, or null.
create or replace function private.co_phone(p_value text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select case when n ~ '^(3[0-9]{9}|60[1-8][0-9]{7})$' then '+57' || n end
  from (select case when d ~ '^57[0-9]{10}$' then substr(d, 3) else d end as n
        from (select regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g') as d) digits) national
$$;

create or replace function private.is_co_phone(p_value text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select coalesce(p_value ~ '^\+57(3[0-9]{9}|60[1-8][0-9]{7})$', false)
$$;

create or replace function private.is_instagram_handle(p_value text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select coalesce(p_value ~ '^[a-z0-9._]{1,30}$', false)
$$;

-- https, a public domain in lower case, only port 443, no user, no IP, no
-- names that exist only inside a network.
create or replace function private.is_public_website(p_value text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select private.is_clean_text(p_value, 1, 200)
     and p_value ~ '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})(:443)?([/?#][^ ]*)?$'
     and substring(p_value from '^https://([^/:?#]+)') !~ '\.(local|localhost|internal|lan|home|corp|test|invalid)$'
$$;

-- Pure functions used by CHECK constraints: whoever writes the row runs them.
-- SECURITY DEFINER only so that their calls to each other resolve without
-- giving clients USAGE on the private schema; they read no table.
revoke execute on function private.clean_text(text, boolean), private.is_clean_text(text, integer, integer, boolean),
  private.is_text_line(text, integer, integer, boolean), private.is_person_name(text, integer),
  private.is_business_name(text, integer), private.is_address(text), private.co_phone(text),
  private.is_co_phone(text), private.is_instagram_handle(text), private.is_public_website(text) from public, anon;
grant execute on function private.clean_text(text, boolean), private.is_clean_text(text, integer, integer, boolean),
  private.is_text_line(text, integer, integer, boolean), private.is_person_name(text, integer),
  private.is_business_name(text, integer), private.is_address(text), private.co_phone(text),
  private.is_co_phone(text), private.is_instagram_handle(text), private.is_public_website(text) to authenticated, service_role;

-- 3. CHECK constraints (NOT VALID: old rows are listed by docs/data-quality.sql) ----------
alter table public.profiles
  drop constraint if exists profiles_full_name_rule,
  add constraint profiles_full_name_rule check (full_name is null or private.is_person_name(full_name)) not valid,
  drop constraint if exists profiles_display_name_rule,
  add constraint profiles_display_name_rule check (display_name is null or private.is_text_line(display_name, 2, 40)) not valid,
  drop constraint if exists profiles_neighborhood_rule,
  add constraint profiles_neighborhood_rule
    check (residence_neighborhood is null or private.is_text_line(residence_neighborhood, 1, 60, true)) not valid;

alter table public.businesses
  drop constraint if exists businesses_name_rule,
  add constraint businesses_name_rule check (private.is_business_name(name)) not valid,
  drop constraint if exists businesses_address_rule,
  add constraint businesses_address_rule check (private.is_address(address)) not valid,
  drop constraint if exists businesses_phone_rule,
  add constraint businesses_phone_rule check (phone is null or private.is_co_phone(phone)) not valid,
  drop constraint if exists businesses_website_rule,
  add constraint businesses_website_rule check (website is null or private.is_public_website(website)) not valid,
  drop constraint if exists businesses_description_rule,
  add constraint businesses_description_rule
    check (description is null or private.is_clean_text(description, 1, 300, true)) not valid;

alter table public.menu_items
  drop constraint if exists menu_items_name_rule,
  add constraint menu_items_name_rule check (private.is_text_line(name, 1, 80, true)) not valid,
  drop constraint if exists menu_items_price_range,
  add constraint menu_items_price_range check (price_cop between 100 and 10000000) not valid,
  drop constraint if exists menu_items_description_rule,
  add constraint menu_items_description_rule
    check (description is null or private.is_clean_text(description, 1, 300, true)) not valid,
  drop constraint if exists menu_items_section_rule,
  add constraint menu_items_section_rule check (section is null or private.is_text_line(section, 1, 40, true)) not valid;

-- 1-90 % contains the old 5-90 %, so this one is valid at once.
alter table public.promotions
  drop constraint if exists promotions_discount_range,
  drop constraint if exists promotions_discount_percent_range,
  add constraint promotions_discount_percent_range
    check (discount_percent is null or discount_percent between 1 and 90),
  drop constraint if exists promotions_title_rule,
  add constraint promotions_title_rule check (private.is_text_line(title, 3, 80)) not valid,
  drop constraint if exists promotions_description_rule,
  add constraint promotions_description_rule
    check (description is null or private.is_clean_text(description, 1, 300, true)) not valid,
  drop constraint if exists promotions_period_length,
  add constraint promotions_period_length check (ends_at <= starts_at + interval '366 days') not valid;

alter table public.reviews
  drop constraint if exists reviews_comment_rule,
  add constraint reviews_comment_rule check (comment is null or private.is_clean_text(comment, 1, 500, true)) not valid;

alter table public.reports
  drop constraint if exists reports_comment_rule,
  add constraint reports_comment_rule check (comment is null or private.is_clean_text(comment, 1, 300, true)) not valid;

alter table public.orders
  drop constraint if exists orders_notes_rule,
  add constraint orders_notes_rule check (notes is null or private.is_clean_text(notes, 1, 200, true)) not valid;

alter table public.business_legal
  drop constraint if exists business_legal_name_rule,
  add constraint business_legal_name_rule check (private.is_business_name(legal_name, 150)) not valid,
  drop constraint if exists business_legal_rep_rule,
  add constraint business_legal_rep_rule check (private.is_person_name(legal_rep_name, 120)) not valid;

alter table public.business_photos
  drop constraint if exists business_photos_caption_rule,
  add constraint business_photos_caption_rule check (caption is null or private.is_text_line(caption, 1, 60, true)) not valid;

-- 4. Server-side cleaning -----------------------------------------------------------------
-- Order notes come through create_order: cleaned here, then checked.
create or replace function private.orders_clean_notes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.notes := nullif(private.clean_text(new.notes, true), '');
  return new;
end;
$$;

revoke execute on function private.orders_clean_notes() from public, anon, authenticated;

drop trigger if exists orders_clean_notes on public.orders;
create trigger orders_clean_notes
  before insert or update of notes on public.orders
  for each row execute procedure private.orders_clean_notes();

-- Phones compare by their +57 form: the same number saved in a new format
-- keeps its verification and its pending request.
create or replace function private.same_contact(p_kind text, p_a text, p_b text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select case when p_kind in ('phone', 'whatsapp')
    then coalesce(private.co_phone(p_a), nullif(btrim(p_a), '')) is not distinct from coalesce(private.co_phone(p_b), nullif(btrim(p_b), ''))
    else p_a is not distinct from p_b
  end
$$;

revoke execute on function private.same_contact(text, text, text) from public, anon, authenticated;

create or replace function private.businesses_clear_contact_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.same_contact('phone', new.phone, old.phone) then new.phone_verified_at := null; end if;
  if not private.same_contact('whatsapp', new.whatsapp, old.whatsapp) then new.whatsapp_verified_at := null; end if;
  if new.instagram is distinct from old.instagram then new.instagram_verified_at := null; end if;
  if new.facebook is distinct from old.facebook then new.facebook_verified_at := null; end if;
  if new.website is distinct from old.website then new.website_verified_at := null; end if;
  -- Another value voids the pending request; the same phone in a new format
  -- moves the request to it, so later comparisons still match.
  update public.contact_verifications v
  set status = case when private.same_contact(v.kind, v.value, private.contact_value(new, v.kind)) then v.status else 'rejected' end,
      value = case when private.same_contact(v.kind, v.value, private.contact_value(new, v.kind))
                   then coalesce(private.contact_value(new, v.kind), v.value) else v.value end
  where v.business_id = new.id and v.status = 'pending'
    and v.value is distinct from private.contact_value(new, v.kind);
  return new;
end;
$$;

revoke execute on function private.businesses_clear_contact_verification() from public, anon, authenticated;

-- 5. Review of migrations 52 and 53 -------------------------------------------------------
-- The owner reads their requests without verified_by (who decided is for the team only).
revoke select on public.contact_verifications from authenticated;
grant select (id, business_id, kind, value, code, status, requested_at, verified_at)
  on public.contact_verifications to authenticated;

-- At most contact_verification_max_daily (3) requests a day per kind and business,
-- not in total; a new request voids the pending ones of the same kind.
create or replace function public.request_contact_verification(p_business_id uuid, p_kind text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_value text;
  v_code text := 'LUMA-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  if not public.is_email_confirmed() then
    raise exception using errcode = 'P0001', message = 'email_not_confirmed';
  end if;
  if p_kind is null or p_kind not in ('phone', 'whatsapp', 'instagram', 'facebook', 'website') then
    raise exception using errcode = 'P0001', message = 'invalid_contact_kind';
  end if;
  select * into v_business from public.businesses b where b.id = p_business_id and b.owner_id = auth.uid() for update;
  if not found then
    raise exception using errcode = '42501', message = 'not_owner';
  end if;
  v_value := private.contact_value(v_business, p_kind);
  if v_value is null then
    raise exception using errcode = 'P0001', message = 'contact_missing';
  end if;
  if (select count(*) from public.contact_verifications v
      where v.business_id = p_business_id and v.kind = p_kind and v.requested_at > now() - interval '1 day')
     >= coalesce((select s.int_value from public.app_settings s where s.key = 'contact_verification_max_daily'), 3) then
    raise exception using errcode = 'P0001', message = 'too_many_requests';
  end if;
  update public.contact_verifications v set status = 'rejected'
  where v.business_id = p_business_id and v.kind = p_kind and v.status = 'pending';
  insert into public.contact_verifications (business_id, kind, value, code)
  values (p_business_id, p_kind, v_value, v_code);
  return v_code;
end;
$$;

revoke execute on function public.request_contact_verification(uuid, text) from public, anon;
grant execute on function public.request_contact_verification(uuid, text) to authenticated;

-- The sign-up name, cleaned; dropped when it breaks the person-name rule.
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
                      then nullif(private.clean_text(v_meta ->> 'full_name'), '') end;
  -- Each consent is recorded only when its own flag is the JSON boolean true;
  -- comparing jsonb values never casts, so no input can raise here.
  v_terms boolean := case when v_meta -> 'accepted_terms' = 'true'::jsonb then true else false end;
  v_privacy boolean := case when v_meta -> 'accepted_privacy' = 'true'::jsonb then true else false end;
  v_age boolean := case when v_meta -> 'confirmed_age' = 'true'::jsonb then true else false end;
begin
  -- A name that breaks the rule is dropped (the user completes it later),
  -- never the whole profile.
  if not coalesce(private.is_person_name(v_name), false) then
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

notify pgrst, 'reload schema';
