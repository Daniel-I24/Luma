-- -----------------------------------------------------------------------------
-- Migration: verification_workflow
-- Submitting a business for review, the admin decision and re-review after
-- sensitive changes. NOT APPLIED YET.
-- -----------------------------------------------------------------------------

-- 1. Submit (owner) --------------------------------------------------------------
-- Returns {"ok": bool, "missing": [codes]}; when ok the business is pending.
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
  select * into b from public.businesses
  where id = p_business_id and owner_id = (select auth.uid())
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'business_not_found';
  end if;
  if b.verification_status not in ('draft', 'rejected') then
    raise exception using errcode = 'P0001', message = 'not_submittable';
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

-- 2. Decide (admin) ---------------------------------------------------------------
-- p_seen_updated_at: businesses.updated_at as the admin saw it; any change
-- since then (owner edit, another admin) rejects the decision as stale_review.
-- Transitions: pending -> approved | rejected | suspended; approved ->
-- suspended; suspended -> approved (reactivation). The owner is notified.
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
end;
$$;

-- 3. Re-review after sensitive changes ----------------------------------------------
-- An approved business whose owner (not an admin) changes its name, address
-- or location goes back to pending. While pending, the owner cannot change
-- them at all (business_under_review): the team reviews what it sees.
create or replace function public.businesses_require_rereview()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.verification_status = 'pending'
     and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'authenticated'
     and not public.is_admin()
     and (new.name is distinct from old.name or new.address is distinct from old.address
          or new.latitude is distinct from old.latitude or new.longitude is distinct from old.longitude) then
    raise exception using errcode = 'P0001', message = 'business_under_review';
  end if;
  if old.verification_status = 'approved'
     and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'authenticated'
     and not public.is_admin()
     and (new.name is distinct from old.name or new.address is distinct from old.address
          or new.latitude is distinct from old.latitude or new.longitude is distinct from old.longitude) then
    new.verification_status := 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists businesses_require_rereview on public.businesses;
create trigger businesses_require_rereview
  before update of name, address, latitude, longitude on public.businesses
  for each row execute procedure public.businesses_require_rereview();

revoke execute on function public.submit_business_for_review(uuid) from public, anon;
revoke execute on function public.review_business(uuid, text, text, timestamptz) from public, anon;
revoke execute on function public.businesses_require_rereview() from public, anon, authenticated;
grant execute on function public.submit_business_for_review(uuid) to authenticated;
grant execute on function public.review_business(uuid, text, text, timestamptz) to authenticated;

notify pgrst, 'reload schema';
