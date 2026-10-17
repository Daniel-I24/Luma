-- -----------------------------------------------------------------------------
-- Migration: business_panel
-- What the business panel needs to manage a business safely. NOT APPLIED YET.
--
--   1. businesses.prep_minutes (5-180, default 20), column grants.
--   2. CHECK constraints the app mirrors with zod (shared/business/data),
--      NOT VALID: existing rows do not block the migration, new and updated
--      rows are checked (VALIDATE them later: docs/migrations.md).
--   3. Owners read their own hours and promotions (also while unpublished or
--      expired); hours can be upserted (one row per day).
--   4. Publishing guard: a client creates businesses unpublished and can only
--      publish one with at least one open day and one available menu item.
--      Unpublishing is always allowed.
-- -----------------------------------------------------------------------------

-- 1. Preparation time ----------------------------------------------------------
alter table public.businesses
  add column if not exists prep_minutes smallint not null default 20
  constraint businesses_prep_minutes_range check (prep_minutes between 5 and 180);

comment on column public.businesses.prep_minutes is
  'Usual preparation time in minutes; used for the ready-time estimate of orders.';

grant insert (prep_minutes), update (prep_minutes) on public.businesses to authenticated;

-- 2. Constraints mirrored by the app -------------------------------------------
-- Keep the category list in sync with shared/business/data/business-categories.ts
-- (scripts/business-categories.test.mjs compares both).
alter table public.businesses
  add constraint businesses_name_length
    check (char_length(btrim(name)) between 2 and 80) not valid,
  add constraint businesses_category_valid
    check (category in (
      'Restaurante', 'Cafetería', 'Panadería', 'Pastelería', 'Heladería',
      'Pizzería', 'Hamburguesería', 'Comida rápida', 'Bar', 'Tienda'
    )) not valid,
  add constraint businesses_description_length
    check (description is null or char_length(description) <= 300) not valid,
  add constraint businesses_address_length
    check (char_length(btrim(address)) between 5 and 200) not valid,
  add constraint businesses_phone_format
    check (phone is null or phone ~ '^\+?[0-9][0-9 ]{6,19}$') not valid,
  add constraint businesses_location_range
    check (latitude between -90 and 90 and longitude between -180 and 180) not valid;

alter table public.business_hours
  add constraint business_hours_open_differs
    check (is_closed or opens_at <> closes_at) not valid;

alter table public.promotions
  add constraint promotions_title_length
    check (char_length(btrim(title)) between 3 and 80) not valid,
  add constraint promotions_description_length
    check (description is null or char_length(description) <= 300) not valid,
  add constraint promotions_dates_order
    check (ends_at > starts_at) not valid;

-- 3. Owner access to hours and promotions --------------------------------------
drop policy if exists "business_hours: owner read own" on public.business_hours;
create policy "business_hours: owner read own"
  on public.business_hours for select
  to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_hours.business_id and b.owner_id = (select auth.uid())
  ));

-- Explicit WITH CHECK: a row can never be moved to someone else's business.
drop policy if exists "business_hours: owner update" on public.business_hours;
create policy "business_hours: owner update"
  on public.business_hours for update
  to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_hours.business_id and b.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = business_hours.business_id and b.owner_id = (select auth.uid())
  ));

-- Upsert (insert ... on conflict (business_id, day_of_week) do update) sets
-- every sent column, business_id included; the policy above guards it.
grant update (business_id) on public.business_hours to authenticated;

drop policy if exists "promotions: owner read own" on public.promotions;
create policy "promotions: owner read own"
  on public.promotions for select
  to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = promotions.business_id and b.owner_id = (select auth.uid())
  ));

drop policy if exists "promotions: owner update" on public.promotions;
create policy "promotions: owner update"
  on public.promotions for update
  to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = promotions.business_id and b.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = promotions.business_id and b.owner_id = (select auth.uid())
  ));

-- 4. Publishing guard ----------------------------------------------------------
-- Runs with the caller's rights (RLS applies) and only for API roles, so
-- seeds and the SQL editor are not affected.
create or replace function public.businesses_guard_publish()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_active := false;
    return new;
  end if;
  if new.is_active and not old.is_active and (
    not exists (
      select 1 from public.business_hours h
      where h.business_id = new.id and not h.is_closed
    )
    or not exists (
      select 1 from public.menu_items m
      where m.business_id = new.id and m.is_available
    )
  ) then
    raise exception using errcode = 'P0001', message = 'publish_requirements_missing';
  end if;
  return new;
end;
$$;

revoke execute on function public.businesses_guard_publish() from public, anon, authenticated;

drop trigger if exists businesses_guard_publish on public.businesses;
create trigger businesses_guard_publish
  before insert or update of is_active on public.businesses
  for each row
  execute procedure public.businesses_guard_publish();

notify pgrst, 'reload schema';
