-- -----------------------------------------------------------------------------
-- Migration: submit_tax_id
-- submit_business_for_review keeps its signature, grants, checks and result
-- ({ ok, missing }) and refuses with 'tax_id_in_use' when the NIT of the
-- business already belongs to a pending or approved business of another
-- user (tax_id_taken, 20261030000600_business_signals.sql).
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

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

notify pgrst, 'reload schema';
