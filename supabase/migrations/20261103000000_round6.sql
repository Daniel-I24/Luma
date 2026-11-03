-- -----------------------------------------------------------------------------
-- Migration: round6
-- Migrations 1 to 51 are applied and 52 (round5) is in review; none is
-- edited. This one depends on 52 (contact_verifications) and only adds.
--   1. Settings (all off by default): contact_auto_whatsapp (phone and
--      WhatsApp verified by an inbound WhatsApp message), contact_auto_website
--      (website verified by a file), the code lifetime (24 h), website checks
--      a day per business (3) and attempts a day per WhatsApp sender (10).
--   2. contact_verifier_config(): which strategy each contact kind uses
--      ('whatsapp', 'website' or 'manual'); instagram and facebook are always
--      'manual' (the admin queue). With a flag off the kind falls back to manual.
--   3. private.whatsapp_messages (ids already processed, cleaned after 7 days)
--      and private.whatsapp_sender_attempts (a salted hash of the sender,
--      never the number) for verify_contact_from_whatsapp, only for
--      service_role (whatsapp-webhook).
--   4. start_website_check (owner, confirmed e-mail, 3 a day per business)
--      and complete_website_check (service_role, verify-website).
--   5. private.mark_contact_verified: the one place that sets
--      <kind>_verified_at automatically and tells the owner.
-- supabase/tests/round6.sql checks each point.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

-- 1. Settings --------------------------------------------------------------------------
insert into public.app_settings (key, int_value) values
  ('contact_auto_whatsapp', 0),
  ('contact_auto_website', 0),
  ('contact_code_ttl_hours', 24),
  ('contact_website_max_daily', 3),
  ('whatsapp_sender_max_daily', 10)
on conflict (key) do nothing;

create or replace function private.setting_on(p_key text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select s.int_value from public.app_settings s where s.key = p_key), 0) = 1
$$;

-- 2. Strategy per kind -----------------------------------------------------------------
create or replace function public.contact_verifier_config()
returns table (kind text, strategy text)
language sql
stable
security definer
set search_path = ''
as $$
  select k.kind,
         case
           when k.kind in ('phone', 'whatsapp') and private.setting_on('contact_auto_whatsapp') then 'whatsapp'
           when k.kind = 'website' and private.setting_on('contact_auto_website') then 'website'
           else 'manual'
         end
  from unnest(array['phone', 'whatsapp', 'instagram', 'facebook', 'website']) as k(kind)
$$;

-- A Colombian number as E.164 (+57 and 10 digits), or null.
create or replace function private.co_e164(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when d ~ '^57[0-9]{10}$' then '+' || d
    when d ~ '^[0-9]{10}$' then '+57' || d
    else null
  end
  from (select regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g') as d) n
$$;

-- 5. Mark verified (automatic strategies) -----------------------------------------------
create or replace function private.mark_contact_verified(p_verification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.contact_verifications;
  v_business public.businesses;
begin
  select * into v_request from public.contact_verifications v where v.id = p_verification_id;
  if not found then
    return false;
  end if;
  -- Business first, then the request: the same order as admin_verify_contact.
  select * into v_business from public.businesses b where b.id = v_request.business_id for update;
  select * into v_request from public.contact_verifications v where v.id = p_verification_id for update;
  if v_request.status <> 'pending'
     or private.contact_value(v_business, v_request.kind) is distinct from v_request.value then
    return false;
  end if;
  update public.contact_verifications set status = 'verified', verified_at = now(), verified_by = null
  where id = p_verification_id;
  update public.businesses set
    phone_verified_at = case when v_request.kind = 'phone' then now() else phone_verified_at end,
    whatsapp_verified_at = case when v_request.kind = 'whatsapp' then now() else whatsapp_verified_at end,
    website_verified_at = case when v_request.kind = 'website' then now() else website_verified_at end
  where id = v_request.business_id;
  insert into public.notifications (user_id, type, business_id, status)
  values (v_business.owner_id, 'contact_verification', v_request.business_id, 'approved');
  return true;
end;
$$;

-- 3. WhatsApp inbound ------------------------------------------------------------------
create table if not exists private.whatsapp_messages (
  message_id   text        not null constraint whatsapp_messages_id_shape check (char_length(message_id) between 1 and 200),
  processed_at timestamptz not null default now(),
  constraint whatsapp_messages_pkey primary key (message_id)
);
create index if not exists whatsapp_messages_processed_idx on private.whatsapp_messages (processed_at);

create table if not exists private.whatsapp_sender_attempts (
  sender_hash text    not null constraint whatsapp_sender_hash_shape check (sender_hash ~ '^[0-9a-f]{64}$'),
  day         date    not null,
  attempts    integer not null default 0,
  constraint whatsapp_sender_attempts_pkey primary key (sender_hash, day)
);
revoke all on private.whatsapp_messages, private.whatsapp_sender_attempts from public, anon, authenticated, service_role;

-- Outcomes: disabled, invalid, duplicate, limited, no_match, expired, verified.
create or replace function public.verify_contact_from_whatsapp(
  p_message_id text, p_sender_hash text, p_sender text, p_code text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender text := private.co_e164(p_sender);
  v_attempts integer;
  v_request public.contact_verifications;
  v_ttl integer := coalesce((select s.int_value from public.app_settings s where s.key = 'contact_code_ttl_hours'), 24);
begin
  if not private.setting_on('contact_auto_whatsapp') then
    return 'disabled';
  end if;
  if p_message_id is null or p_sender_hash !~ '^[0-9a-f]{64}$' or v_sender is null
     or p_code !~ '^LUMA-[A-Z0-9]{6}$' then
    return 'invalid';
  end if;
  delete from private.whatsapp_messages where processed_at < now() - interval '7 days';
  insert into private.whatsapp_messages (message_id) values (left(p_message_id, 200)) on conflict do nothing;
  if not found then
    return 'duplicate';
  end if;
  delete from private.whatsapp_sender_attempts where day < current_date - 1;
  insert into private.whatsapp_sender_attempts as a (sender_hash, day, attempts)
  values (p_sender_hash, current_date, 1)
  on conflict (sender_hash, day) do update set attempts = a.attempts + 1
  returning attempts into v_attempts;
  if v_attempts > coalesce((select s.int_value from public.app_settings s where s.key = 'whatsapp_sender_max_daily'), 10) then
    return 'limited';
  end if;
  select * into v_request from public.contact_verifications v
  where v.code = p_code and v.status = 'pending' and v.kind in ('phone', 'whatsapp')
  order by v.requested_at desc limit 1;
  if not found or private.co_e164(v_request.value) is distinct from v_sender then
    -- Another number's code, or no such code: nothing is said about which.
    return 'no_match';
  end if;
  if v_request.requested_at < now() - make_interval(hours => v_ttl) then
    return 'expired';
  end if;
  return case when private.mark_contact_verified(v_request.id) then 'verified' else 'no_match' end;
end;
$$;

-- 4. Website file ----------------------------------------------------------------------
create table if not exists private.website_checks (
  business_id uuid        not null references public.businesses (id) on delete cascade,
  checked_at  timestamptz not null default now()
);
create index if not exists website_checks_business_idx on private.website_checks (business_id, checked_at);
revoke all on private.website_checks from public, anon, authenticated, service_role;

-- The owner's pending website request to check now (one of today's 3 checks).
create or replace function public.start_website_check(p_business_id uuid)
returns table (verification_id uuid, website text, code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.contact_verifications;
  v_ttl integer := coalesce((select s.int_value from public.app_settings s where s.key = 'contact_code_ttl_hours'), 24);
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  if not public.is_email_confirmed() then
    raise exception using errcode = 'P0001', message = 'email_not_confirmed';
  end if;
  if not exists (select 1 from public.businesses b where b.id = p_business_id and b.owner_id = auth.uid()) then
    raise exception using errcode = '42501', message = 'not_owner';
  end if;
  if not private.setting_on('contact_auto_website') then
    raise exception using errcode = 'P0001', message = 'auto_disabled';
  end if;
  select * into v_request from public.contact_verifications v
  where v.business_id = p_business_id and v.kind = 'website' and v.status = 'pending'
    and v.requested_at > now() - make_interval(hours => v_ttl)
  order by v.requested_at desc limit 1;
  if not found then
    raise exception using errcode = 'P0001', message = 'no_pending_request';
  end if;
  if (select count(*) from private.website_checks c
      where c.business_id = p_business_id and c.checked_at > now() - interval '1 day')
     >= coalesce((select s.int_value from public.app_settings s where s.key = 'contact_website_max_daily'), 3) then
    raise exception using errcode = 'P0001', message = 'too_many_checks';
  end if;
  insert into private.website_checks (business_id) values (p_business_id);
  return query select v_request.id, v_request.value, v_request.code;
end;
$$;

create or replace function public.complete_website_check(p_verification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.setting_on('contact_auto_website') then
    return false;
  end if;
  if not exists (select 1 from public.contact_verifications v where v.id = p_verification_id and v.kind = 'website') then
    return false;
  end if;
  return private.mark_contact_verified(p_verification_id);
end;
$$;

-- Grants -------------------------------------------------------------------------------
revoke execute on function private.setting_on(text) from public, anon, authenticated;
revoke execute on function private.co_e164(text) from public, anon, authenticated;
revoke execute on function private.mark_contact_verified(uuid) from public, anon, authenticated;
revoke execute on function public.contact_verifier_config() from public, anon;
grant execute on function public.contact_verifier_config() to authenticated;
revoke execute on function public.verify_contact_from_whatsapp(text, text, text, text) from public, anon, authenticated;
grant execute on function public.verify_contact_from_whatsapp(text, text, text, text) to service_role;
revoke execute on function public.start_website_check(uuid) from public, anon;
grant execute on function public.start_website_check(uuid) to authenticated;
revoke execute on function public.complete_website_check(uuid) from public, anon, authenticated;
grant execute on function public.complete_website_check(uuid) to service_role;

notify pgrst, 'reload schema';
