-- -----------------------------------------------------------------------------
-- Migration: round9 (pending review, depends on 20261105000000_round8)
--   1. review_business: approving a business in review also publishes it
--      (is_active = true) when it already has an open day and an available
--      product, the same rule as businesses_guard_publish. Otherwise it stays
--      hidden and the owner's summary says what is missing. The owner can
--      pause it afterwards; a re-approval after a suspension never touches
--      is_active (the owner's choice stays).
--   2. The only visible rule is max_businesses_per_owner (3). The daily
--      creation limit becomes an internal guard of 10 a day.
-- NOT APPLIED YET. SQL comments in ASCII.
-- -----------------------------------------------------------------------------

-- 1. Approving publishes when it can ---------------------------------------------------
create or replace function private.meets_publish_requirements(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.business_hours h where h.business_id = p_business_id and not h.is_closed)
     and exists (select 1 from public.menu_items m where m.business_id = p_business_id and m.is_available)
$$;

revoke execute on function private.meets_publish_requirements(uuid) from public, anon, authenticated;

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
  v_publish boolean;
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
  if p_decision = 'approved' and public.tax_id_taken(p_business_id) then
    raise exception using errcode = 'P0001', message = 'tax_id_in_use';
  end if;
  v_publish := v_status = 'pending' and p_decision = 'approved'
               and private.meets_publish_requirements(p_business_id);
  update public.businesses
  set verification_status = p_decision,
      verification_note = case when p_decision = 'approved' then null else left(v_note, 300) end,
      verified_at = case when p_decision = 'approved' then now() else verified_at end,
      is_active = case when v_publish then true else is_active end
  where id = p_business_id;
  insert into public.notifications (user_id, type, business_id, status)
  values (v_owner, 'business_review', p_business_id, p_decision);
  perform public.log_admin_action('review_business', 'business', p_business_id, p_decision);
end;
$$;

revoke execute on function public.review_business(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.review_business(uuid, text, text, timestamptz) to authenticated;

-- 2. Businesses per owner: 3 is the rule, 10 creations a day an internal guard ------------
update public.app_settings set int_value = 10
where key = 'rate_business_create_max' and int_value = 3;

notify pgrst, 'reload schema';
