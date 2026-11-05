-- =============================================================================
-- Round 10 (pending review; never edit 1 to 56, all applied).
--
-- 1. Business location (docs/location.md): optional sector
--    (businesses.neighborhood) and reference ("al frente del parque",
--    businesses.address_reference), with the text rules of round 7.
-- 2. order_pickup_point(order_id): name, address and coordinates of the
--    business of an order, for the customer of that order only, while it is
--    accepted, being prepared or ready, even when the business is no longer
--    public (paused, suspended): the customer must still be able to arrive.
-- 3. Realtime privacy: each order change writes two order_events rows, one
--    with only user_id (the customer) and one with only business_id (the
--    owner), so an owner never receives a customer id. Reading policy and a
--    CHECK follow.
-- 4. The 20 oldest policies use (select auth.uid()) instead of auth.uid()
--    (evaluated once per query, not per row); their conditions do not change.
-- =============================================================================

-- 1. Sector and reference ---------------------------------------------------------
alter table public.businesses
  add column if not exists neighborhood text,
  add column if not exists address_reference text;

alter table public.businesses drop constraint if exists businesses_neighborhood_rule;
alter table public.businesses add constraint businesses_neighborhood_rule
  check (neighborhood is null or private.is_text_line(neighborhood, 1, 60, true));
alter table public.businesses drop constraint if exists businesses_address_reference_rule;
alter table public.businesses add constraint businesses_address_reference_rule
  check (address_reference is null or private.is_text_line(address_reference, 1, 100, true));

grant insert (neighborhood, address_reference), update (neighborhood, address_reference)
  on public.businesses to authenticated;

-- 2. Where to pick an order up ----------------------------------------------------
create or replace function public.order_pickup_point(p_order_id uuid)
returns table (name text, address text, latitude double precision, longitude double precision)
language sql
stable
security definer
set search_path = ''
as $$
  -- The copies taken with the order (name, address) and the live coordinates.
  select o.business_name, o.business_address, b.latitude, b.longitude
  from public.orders o
  join public.businesses b on b.id = o.business_id
  where o.id = p_order_id
    and o.user_id = (select auth.uid())
    and o.status in ('accepted', 'preparing', 'ready');
$$;
revoke execute on function public.order_pickup_point(uuid) from public, anon;
grant execute on function public.order_pickup_point(uuid) to authenticated;

-- 3. Order events without the customer id for the owner ---------------------------------
create or replace function private.orders_order_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_events (order_id, user_id, business_id) values (new.id, new.user_id, null);
  if new.business_id is not null then
    insert into public.order_events (order_id, user_id, business_id) values (new.id, null, new.business_id);
  end if;
  return null;
end;
$$;
revoke execute on function private.orders_order_event() from public, anon, authenticated;

-- Events live one day at most: the old shape is simply dropped.
delete from public.order_events where user_id is not null and business_id is not null;
alter table public.order_events drop constraint if exists order_events_one_audience;
alter table public.order_events add constraint order_events_one_audience
  check (user_id is null or business_id is null);

drop policy if exists order_events_read on public.order_events;
create policy order_events_read on public.order_events for select to authenticated using (
  (user_id is not null and user_id = (select auth.uid()))
  or (user_id is null and business_id is not null and exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())))
);

-- 4. RLS evaluated once per query ----------------------------------------------------
-- The oldest policies called auth.uid() for every row; (select auth.uid()) is
-- evaluated once (Supabase "RLS performance"). Same conditions, same names.
alter policy "business_hours: owner delete" on public.business_hours
  using (EXISTS ( SELECT 1 FROM public.businesses b WHERE ((b.id = business_hours.business_id) AND (b.owner_id = (select auth.uid())))));
alter policy "business_hours: owner insert" on public.business_hours
  with check (EXISTS ( SELECT 1 FROM public.businesses b WHERE ((b.id = business_hours.business_id) AND (b.owner_id = (select auth.uid())))));
alter policy "businesses: owner delete" on public.businesses
  using ((select auth.uid()) = owner_id);
alter policy "businesses: owner insert" on public.businesses
  with check ((select auth.uid()) = owner_id);
alter policy "businesses: owner read own" on public.businesses
  using ((select auth.uid()) = owner_id);
alter policy "businesses: owner update" on public.businesses
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
alter policy "favorites: owner delete" on public.favorites
  using ((select auth.uid()) = user_id);
alter policy "favorites: owner insert" on public.favorites
  with check ((select auth.uid()) = user_id);
alter policy "favorites: owner select" on public.favorites
  using ((select auth.uid()) = user_id);
alter policy "menu_items: owner delete" on public.menu_items
  using (EXISTS ( SELECT 1 FROM public.businesses b WHERE ((b.id = menu_items.business_id) AND (b.owner_id = (select auth.uid())))));
alter policy "menu_items: owner insert" on public.menu_items
  with check (EXISTS ( SELECT 1 FROM public.businesses b WHERE ((b.id = menu_items.business_id) AND (b.owner_id = (select auth.uid())))));
alter policy "menu_items: owner read own" on public.menu_items
  using (EXISTS ( SELECT 1 FROM public.businesses b WHERE ((b.id = menu_items.business_id) AND (b.owner_id = (select auth.uid())))));
alter policy "menu_items: owner update" on public.menu_items
  using (EXISTS ( SELECT 1 FROM public.businesses b WHERE ((b.id = menu_items.business_id) AND (b.owner_id = (select auth.uid())))))
  with check (EXISTS ( SELECT 1 FROM public.businesses b WHERE ((b.id = menu_items.business_id) AND (b.owner_id = (select auth.uid())))));
alter policy "profiles: owner can select" on public.profiles
  using ((select auth.uid()) = id);
alter policy "profiles: owner can update" on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
alter policy "promotions: owner delete" on public.promotions
  using (EXISTS ( SELECT 1 FROM public.businesses b WHERE ((b.id = promotions.business_id) AND (b.owner_id = (select auth.uid())))));
alter policy "promotions: owner insert" on public.promotions
  with check (EXISTS ( SELECT 1 FROM public.businesses b WHERE ((b.id = promotions.business_id) AND (b.owner_id = (select auth.uid())))));
alter policy "reviews: author delete" on public.reviews
  using ((select auth.uid()) = user_id);
alter policy "reviews: author read own" on public.reviews
  using ((select auth.uid()) = user_id);
alter policy "reviews: author update" on public.reviews
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- PostgREST picks up the new columns, function and policies.
notify pgrst, 'reload schema';
