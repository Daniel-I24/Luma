-- -----------------------------------------------------------------------------
-- Migration: review_business_audit
-- review_business keeps its signature, grants and behaviour (transitions,
-- note rules, stale_review to the microsecond, owner notification) and now
-- writes one admin_audit_log row per decision (detail: the decision).
-- is_admin() needs aal2 since 20261030000000_admin_mfa_audit.sql.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

create or replace function public.review_business(
  p_business_id uuid, p_decision text, p_note text, p_seen_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_owner uuid;
  v_updated timestamptz;
  v_note text := nullif(btrim(p_note), '');
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  if p_decision not in ('approved', 'rejected', 'suspended') then
    raise exception using errcode = 'P0001', message = 'invalid_decision';
  end if;
  if p_decision in ('rejected', 'suspended') and v_note is null then
    raise exception using errcode = 'P0001', message = 'note_required';
  end if;
  select verification_status, owner_id, updated_at into v_status, v_owner, v_updated
  from public.businesses where id = p_business_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'business_not_found';
  end if;
  if v_updated is distinct from p_seen_updated_at then
    raise exception using errcode = 'P0001', message = 'stale_review';
  end if;
  if (v_status, p_decision) not in (
    ('pending', 'approved'), ('pending', 'rejected'), ('pending', 'suspended'),
    ('approved', 'suspended'), ('suspended', 'approved')
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_transition';
  end if;
  update public.businesses
  set verification_status = p_decision,
      verification_note = case when p_decision = 'approved' then null else left(v_note, 300) end,
      verified_at = case when p_decision = 'approved' then now() else verified_at end
  where id = p_business_id;
  insert into public.notifications (user_id, type, business_id, status)
  values (v_owner, 'business_review', p_business_id, p_decision);
  perform public.log_admin_action('review_business', 'business', p_business_id, p_decision);
end;
$$;

revoke execute on function public.review_business(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.review_business(uuid, text, text, timestamptz) to authenticated;

notify pgrst, 'reload schema';
