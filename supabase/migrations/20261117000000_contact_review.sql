-- -----------------------------------------------------------------------------
-- Migration: contact_review
-- Only adds and replaces. Contact verifications the review team can act on:
--   1. contact_verifications.reject_reason: why the team rejected a request;
--      the owner reads it (column grant).
--   2. Notification status 'contact_requested': sent to every admin when an
--      owner asks to verify a contact (the app lists it; push-dispatch sends it).
--   3. request_contact_verification: same signature and limits; it now tells
--      the admins, once per business while their notice is unread.
--   4. admin_verify_contact(id, decision, reason): a rejection needs a reason
--      (3 to 300 characters, cleaned). The two-argument version is replaced;
--      the reason defaults to null, so a call without it still verifies.
-- A rejection by the team has verified_at (when it was decided); a request
-- replaced by a newer one or voided by a changed value has none.
-- -----------------------------------------------------------------------------

-- 1. The reason ------------------------------------------------------------------------------
alter table public.contact_verifications add column if not exists reject_reason text;
alter table public.contact_verifications drop constraint if exists contact_verifications_reject_reason_shape;
alter table public.contact_verifications add constraint contact_verifications_reject_reason_shape
  check (reject_reason is null or (status = 'rejected' and private.is_clean_text(reject_reason, 3, 300, true)));
grant select (reject_reason) on public.contact_verifications to authenticated;

-- 2. Notification status ---------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_status_valid;
alter table public.notifications add constraint notifications_status_valid check (
  status is null or status in ('awaiting_payment', 'pending', 'accepted', 'preparing', 'ready', 'picked_up',
                               'cancelled', 'approved', 'rejected', 'suspended', 'declined', 'voided',
                               'refund_required', 'refunded', 'error', 'refund_pending_admin', 'duplicate_charge',
                               'contact_requested'));

-- 3. A request tells the team ---------------------------------------------------------------
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
  -- One unread notice per admin and business is enough: the queue lists every request.
  insert into public.notifications (user_id, type, business_id, status)
  select a.user_id, 'contact_verification', p_business_id, 'contact_requested'
  from public.admins a
  where not exists (select 1 from public.notifications n
                    where n.user_id = a.user_id and n.type = 'contact_verification'
                      and n.status = 'contact_requested' and n.business_id = p_business_id and n.read_at is null);
  return v_code;
end;
$$;
revoke execute on function public.request_contact_verification(uuid, text) from public, anon;
grant execute on function public.request_contact_verification(uuid, text) to authenticated;

-- 4. The decision, with a reason to reject ---------------------------------------------------
drop function if exists public.admin_verify_contact(uuid, text);
create or replace function public.admin_verify_contact(p_verification_id uuid, p_decision text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.contact_verifications;
  v_business public.businesses;
  v_reason text := nullif(private.clean_text(p_reason, true), '');
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  if p_decision is null or p_decision not in ('verified', 'rejected') then
    raise exception using errcode = 'P0001', message = 'invalid_decision';
  end if;
  if p_decision = 'rejected' and (v_reason is null or char_length(v_reason) not between 3 and 300) then
    raise exception using errcode = 'P0001', message = 'reason_required';
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
  set status = p_decision, verified_at = now(), verified_by = auth.uid(),
      reject_reason = case when p_decision = 'rejected' then v_reason end
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
revoke execute on function public.admin_verify_contact(uuid, text, text) from public, anon;
grant execute on function public.admin_verify_contact(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
