-- -----------------------------------------------------------------------------
-- Migration: round5
-- Migrations 1 to 51 are applied; this one only adds and replaces. Same
-- signatures, return types and grants for every replaced function.
--   1. create_order: 'own_business' when the customer owns the business. Every
--      other protection stays as in create_order_final, in the same order.
--   2. Verifiable contacts (no cost, human review): contact_verifications,
--      businesses.<kind>_verified_at (only admin_verify_contact writes them;
--      owners have no column grant), a trigger that clears one when the
--      owner changes that value, request_contact_verification (owner,
--      confirmed e-mail, 3 a day per business, returns 'LUMA-XXXXXX'),
--      admin_pending_contact_verifications and admin_verify_contact (admin
--      with aal2, audit action 'verify_contact', notifies the owner).
--   3. business_trust_summary: what a customer may know about a public
--      business (verified since, verified contact kinds, completed orders as
--      a range, months on Luma). Never the NIT, legal name, documents or
--      personal data.
--   4. request_legal_correction: an approved business asks to correct its
--      legal data; it goes back to changes requested ('rejected' with the
--      note 'owner_correction'), stops being public and the legal data and
--      documents can be edited until a new review.
--   5. Push: notification type 'test' and send_test_notification() (3 a day).
--   6. Rate limit bucket 'route' for the route Edge Function (60 a day).
-- supabase/tests/round5.sql checks each point.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

-- 0. Settings, notifications and audit ------------------------------------------------
insert into public.app_settings (key, int_value) values
  ('contact_verification_max_daily', 3),
  ('rate_push_test_max', 3),
  ('rate_push_test_window_seconds', 86400),
  ('rate_route_max', 60),
  ('rate_route_window_seconds', 86400)
on conflict (key) do nothing;

alter table public.notifications drop constraint if exists notifications_type_valid;
alter table public.notifications add constraint notifications_type_valid check (type in
  ('order_status', 'order_new', 'order_cancelled', 'business_review', 'promotion', 'payment', 'review_invite',
   'contact_verification', 'test'));

alter table public.admin_audit_log drop constraint if exists admin_audit_log_action_valid;
alter table public.admin_audit_log add constraint admin_audit_log_action_valid
  check (action in ('review_business', 'void_payment', 'mark_refund_done', 'clear_strikes', 'reconcile_payments',
                    'verify_contact'));

-- 1. create_order: not in one's own business -----------------------------------------
create or replace function public.create_order(
  p_business_id uuid, p_items jsonb, p_pickup_at timestamptz default null, p_notes text default null,
  p_payment_method text default 'pay_at_pickup'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_notes    text := nullif(btrim(p_notes), '');
  v_now      timestamptz := now();
  v_distinct integer;
  v_available integer;
  v_total    bigint;
  v_order_id uuid;
  v_business record;
  v_tier     text;
begin
  if v_user is null then
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
  select b.name, b.address, b.owner_id into v_business
  from public.businesses b where b.id = p_business_id and public.is_business_public(b.id);
  if not found then
    raise exception using errcode = 'P0001', message = 'business_unavailable';
  end if;
  -- An owner never orders from their own business (fake orders, self-promotion).
  if v_business.owner_id = v_user then
    raise exception using errcode = 'P0001', message = 'own_business';
  end if;
  if public.business_paused(p_business_id) then
    raise exception using errcode = 'P0001', message = 'business_paused';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20
     or exists (
       select 1 from jsonb_array_elements(p_items) e
       where jsonb_typeof(e) <> 'object'
          or jsonb_typeof(e -> 'menu_item_id') is distinct from 'string'
          or (e ->> 'menu_item_id') !~* '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$'
          or jsonb_typeof(e -> 'quantity') is distinct from 'number'
          or case when (e ->> 'quantity') ~ '^[0-9]{1,2}$' then (e ->> 'quantity')::integer not between 1 and 20
                  else true end) then
    raise exception using errcode = 'P0001', message = 'invalid_items';
  end if;
  select count(distinct (e ->> 'menu_item_id')::uuid) into v_distinct from jsonb_array_elements(p_items) e;
  if v_distinct <> jsonb_array_length(p_items) then
    raise exception using errcode = 'P0001', message = 'duplicate_items';
  end if;
  select count(*), sum(l.unit_price_cop::bigint * l.quantity) into v_available, v_total
  from public.order_line_prices(p_business_id, p_items, v_now) l;
  if v_available <> v_distinct then
    raise exception using errcode = 'P0001', message = 'item_unavailable';
  end if;
  if p_pickup_at is not null
     and (p_pickup_at < v_now + interval '10 minutes' or p_pickup_at > v_now + interval '7 days') then
    raise exception using errcode = 'P0001', message = 'invalid_pickup_time';
  end if;
  if not public.business_open_at(p_business_id, coalesce(p_pickup_at, v_now)) then
    raise exception using errcode = 'P0001', message = 'business_closed';
  end if;
  if char_length(v_notes) > 200 then
    raise exception using errcode = 'P0001', message = 'invalid_notes';
  end if;
  if v_total > coalesce((select s.int_value from public.app_settings s where s.key = 'order_max_total_cop'), 500000) then
    raise exception using errcode = 'P0001', message = 'total_too_high';
  end if;
  if p_payment_method is null or p_payment_method not in ('pay_at_pickup', 'online') then
    raise exception using errcode = 'P0001', message = 'invalid_payment_method';
  end if;
  if p_payment_method = 'online' and not (select c.enabled from public.payment_config() c) then
    raise exception using errcode = 'P0001', message = 'payments_disabled';
  end if;

  -- One order creation at a time per user, so every count below holds.
  perform pg_advisory_xact_lock(hashtextextended('create_order:' || v_user::text, 0));
  v_tier := public.customer_trust_tier(v_user);
  if v_tier = 'restricted' and p_payment_method <> 'online' then
    raise exception using errcode = 'P0001', message = 'account_restricted';
  end if;
  if v_tier = 'new' and p_payment_method = 'pay_at_pickup' and (select count(*) from public.orders o
       where o.user_id = v_user and o.payment_method = 'pay_at_pickup'
         and o.status in ('pending', 'accepted', 'preparing', 'ready'))
     >= coalesce((select s.int_value from public.app_settings s where s.key = 'trust_new_max_pending_pickup'), 1) then
    raise exception using errcode = 'P0001', message = 'trust_pending_limit';
  end if;
  if v_tier = 'new' and (select count(*) from public.orders o
       where o.user_id = v_user and public.app_local_time(o.created_at)::date = public.app_local_time(v_now)::date)
     >= coalesce((select s.int_value from public.app_settings s where s.key = 'trust_new_max_daily'), 3) then
    raise exception using errcode = 'P0001', message = 'trust_daily_limit';
  end if;
  if (select count(*) from public.orders o where o.user_id = v_user and o.status in ('pending', 'awaiting_payment'))
     >= coalesce((select s.int_value from public.app_settings s where s.key = 'order_max_pending_per_user'), 5) then
    raise exception using errcode = 'P0001', message = 'too_many_pending';
  end if;
  -- Hourly caps count every order, cancelled ones too (no create/cancel loops).
  if (select count(*) from public.orders o where o.user_id = v_user and o.created_at > v_now - interval '1 hour')
     >= coalesce((select s.int_value from public.app_settings s where s.key = 'order_max_per_hour_per_user'), 6)
     or (select count(*) from public.orders o
         where o.user_id = v_user and o.business_id = p_business_id and o.created_at > v_now - interval '1 hour')
     >= coalesce((select s.int_value from public.app_settings s where s.key = 'order_max_per_hour_per_business'), 2) then
    raise exception using errcode = 'P0001', message = 'too_many_orders';
  end if;

  insert into public.orders (user_id, business_id, business_name, business_address, pickup_at, total_cop, notes,
                             payment_method, status)
  values (v_user, p_business_id, v_business.name, v_business.address, p_pickup_at, v_total, v_notes, p_payment_method,
          case when p_payment_method = 'online' then 'awaiting_payment' else 'pending' end)
  returning id into v_order_id;
  insert into public.order_items (order_id, menu_item_id, name, unit_price_cop, list_price_cop, promotion_id, quantity)
  select v_order_id, l.menu_item_id, l.name, l.unit_price_cop, l.list_price_cop, l.promotion_id, l.quantity
  from public.order_line_prices(p_business_id, p_items, v_now) l;
  return v_order_id;
end;
$$;

revoke execute on function public.create_order(uuid, jsonb, timestamptz, text, text) from public, anon;
grant execute on function public.create_order(uuid, jsonb, timestamptz, text, text) to authenticated;

-- 2. Verifiable contacts --------------------------------------------------------------
alter table public.businesses
  add column if not exists phone_verified_at timestamptz,
  add column if not exists whatsapp_verified_at timestamptz,
  add column if not exists instagram_verified_at timestamptz,
  add column if not exists facebook_verified_at timestamptz,
  add column if not exists website_verified_at timestamptz;
-- No insert/update grant on them: owners cannot write them (column grants, migration grant_existing_tables).

create table if not exists public.contact_verifications (
  id           uuid        not null default gen_random_uuid(),
  business_id  uuid        not null references public.businesses (id) on delete cascade,
  kind         text        not null constraint contact_verifications_kind_valid
    check (kind in ('phone', 'whatsapp', 'instagram', 'facebook', 'website')),
  value        text        not null constraint contact_verifications_value_shape check (char_length(value) between 1 and 200),
  code         text        not null constraint contact_verifications_code_shape check (code ~ '^LUMA-[A-Z0-9]{6}$'),
  status       text        not null default 'pending' constraint contact_verifications_status_valid
    check (status in ('pending', 'verified', 'rejected')),
  requested_at timestamptz not null default now(),
  verified_at  timestamptz,
  verified_by  uuid,
  constraint contact_verifications_pkey primary key (id)
);
create index if not exists contact_verifications_business_idx on public.contact_verifications (business_id, requested_at desc);
create index if not exists contact_verifications_pending_idx on public.contact_verifications (requested_at) where status = 'pending';

alter table public.contact_verifications enable row level security;
revoke all on public.contact_verifications from public, anon, authenticated;
grant select on public.contact_verifications to authenticated;
drop policy if exists "contact_verifications: owner reads" on public.contact_verifications;
create policy "contact_verifications: owner reads"
  on public.contact_verifications for select to authenticated
  using (public.owns_business(business_id));

-- The current value of one contact kind of a business.
create or replace function private.contact_value(p_business public.businesses, p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(case p_kind
    when 'phone' then p_business.phone
    when 'whatsapp' then p_business.whatsapp
    when 'instagram' then p_business.instagram
    when 'facebook' then p_business.facebook
    when 'website' then p_business.website
  end), '')
$$;

-- A changed value is not verified any more; its pending requests are void.
create or replace function private.businesses_clear_contact_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.phone is distinct from old.phone then new.phone_verified_at := null; end if;
  if new.whatsapp is distinct from old.whatsapp then new.whatsapp_verified_at := null; end if;
  if new.instagram is distinct from old.instagram then new.instagram_verified_at := null; end if;
  if new.facebook is distinct from old.facebook then new.facebook_verified_at := null; end if;
  if new.website is distinct from old.website then new.website_verified_at := null; end if;
  update public.contact_verifications v set status = 'rejected'
  where v.business_id = new.id and v.status = 'pending'
    and v.value is distinct from private.contact_value(new, v.kind);
  return new;
end;
$$;

drop trigger if exists businesses_clear_contact_verification on public.businesses;
create trigger businesses_clear_contact_verification
  before update of phone, whatsapp, instagram, facebook, website on public.businesses
  for each row execute procedure private.businesses_clear_contact_verification();

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
      where v.business_id = p_business_id and v.requested_at > now() - interval '1 day')
     >= coalesce((select s.int_value from public.app_settings s where s.key = 'contact_verification_max_daily'), 3) then
    raise exception using errcode = 'P0001', message = 'too_many_requests';
  end if;
  insert into public.contact_verifications (business_id, kind, value, code)
  values (p_business_id, p_kind, v_value, v_code);
  return v_code;
end;
$$;

create or replace function public.admin_pending_contact_verifications()
returns table (id uuid, business_id uuid, business_name text, kind text, value text, code text,
               requested_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  return query
    select v.id, v.business_id, b.name, v.kind, v.value, v.code, v.requested_at
    from public.contact_verifications v
    join public.businesses b on b.id = v.business_id
    where v.status = 'pending'
    order by v.requested_at
    limit 200;
end;
$$;

create or replace function public.admin_verify_contact(p_verification_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.contact_verifications;
  v_business public.businesses;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  if p_decision is null or p_decision not in ('verified', 'rejected') then
    raise exception using errcode = 'P0001', message = 'invalid_decision';
  end if;
  select * into v_request from public.contact_verifications v where v.id = p_verification_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'verification_not_found';
  end if;
  -- Business first, then the request: the same order as the owner's update trigger.
  select * into v_business from public.businesses b where b.id = v_request.business_id for update;
  select * into v_request from public.contact_verifications v where v.id = p_verification_id for update;
  if v_request.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'verification_not_pending';
  end if;
  if p_decision = 'verified' and private.contact_value(v_business, v_request.kind) is distinct from v_request.value then
    raise exception using errcode = 'P0001', message = 'contact_changed';
  end if;
  update public.contact_verifications
  set status = p_decision, verified_at = now(), verified_by = auth.uid()
  where id = p_verification_id;
  if p_decision = 'verified' then
    update public.businesses set
      phone_verified_at = case when v_request.kind = 'phone' then now() else phone_verified_at end,
      whatsapp_verified_at = case when v_request.kind = 'whatsapp' then now() else whatsapp_verified_at end,
      instagram_verified_at = case when v_request.kind = 'instagram' then now() else instagram_verified_at end,
      facebook_verified_at = case when v_request.kind = 'facebook' then now() else facebook_verified_at end,
      website_verified_at = case when v_request.kind = 'website' then now() else website_verified_at end
    where id = v_request.business_id;
  end if;
  insert into public.notifications (user_id, type, business_id, status)
  values (v_business.owner_id, 'contact_verification', v_request.business_id,
          case when p_decision = 'verified' then 'approved' else 'rejected' end);
  perform public.log_admin_action('verify_contact', 'business', v_request.business_id, v_request.kind);
end;
$$;

revoke execute on function private.contact_value(public.businesses, text) from public, anon, authenticated;
revoke execute on function private.businesses_clear_contact_verification() from public, anon, authenticated;
revoke execute on function public.request_contact_verification(uuid, text) from public, anon;
revoke execute on function public.admin_pending_contact_verifications() from public, anon;
revoke execute on function public.admin_verify_contact(uuid, text) from public, anon;
grant execute on function public.request_contact_verification(uuid, text) to authenticated;
grant execute on function public.admin_pending_contact_verifications() to authenticated;
grant execute on function public.admin_verify_contact(uuid, text) to authenticated;

-- 3. Public trust summary -------------------------------------------------------------
create or replace function public.business_trust_summary(p_business_id uuid)
returns table (verified_since timestamptz, verified_contacts text[], completed_orders text, months_on_luma integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business public.businesses;
  v_completed bigint;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  select * into v_business from public.businesses b where b.id = p_business_id and public.is_business_public(b.id);
  if not found then
    raise exception using errcode = 'P0001', message = 'business_unavailable';
  end if;
  select count(*) into v_completed from public.orders o where o.business_id = p_business_id and o.status = 'picked_up';
  return query select
    v_business.verified_at,
    array_remove(array[
      case when v_business.phone_verified_at is not null then 'phone' end,
      case when v_business.whatsapp_verified_at is not null then 'whatsapp' end,
      case when v_business.instagram_verified_at is not null then 'instagram' end,
      case when v_business.facebook_verified_at is not null then 'facebook' end,
      case when v_business.website_verified_at is not null then 'website' end
    ], null),
    -- A range, never the exact count.
    case when v_completed = 0 then '0' when v_completed <= 10 then '1_10' when v_completed <= 50 then '11_50'
         when v_completed <= 200 then '51_200' else '200_plus' end,
    greatest(0, (extract(year from age(now(), v_business.created_at)) * 12
                 + extract(month from age(now(), v_business.created_at)))::integer);
end;
$$;

revoke execute on function public.business_trust_summary(uuid) from public, anon;
grant execute on function public.business_trust_summary(uuid) to authenticated;

-- 4. Legal data correction of an approved business ------------------------------------
create or replace function public.request_legal_correction(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  if not public.is_email_confirmed() then
    raise exception using errcode = 'P0001', message = 'email_not_confirmed';
  end if;
  select b.verification_status into v_status from public.businesses b
  where b.id = p_business_id and b.owner_id = auth.uid() for update;
  if not found then
    raise exception using errcode = '42501', message = 'not_owner';
  end if;
  if v_status <> 'approved' then
    raise exception using errcode = 'P0001', message = 'invalid_transition';
  end if;
  -- Like a sensitive change: not public until a new review approves it again.
  update public.businesses
  set verification_status = 'rejected', verification_note = 'owner_correction'
  where id = p_business_id;
end;
$$;

revoke execute on function public.request_legal_correction(uuid) from public, anon;
grant execute on function public.request_legal_correction(uuid) to authenticated;

-- 5. Test push ------------------------------------------------------------------------
create or replace function public.send_test_notification()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.hit_rate_limit('push_test') then
    raise exception using errcode = 'P0001', message = 'rate_limited';
  end if;
  insert into public.notifications (user_id, type) values (auth.uid(), 'test');
end;
$$;

revoke execute on function public.send_test_notification() from public, anon;
grant execute on function public.send_test_notification() to authenticated;

notify pgrst, 'reload schema';
