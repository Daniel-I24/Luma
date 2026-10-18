-- -----------------------------------------------------------------------------
-- Migration: public_visibility
-- One rule for what the public sees: a business is public when it is
-- published (is_active) AND verified (verification_status = 'approved').
-- Every public read policy, the reviews view and the Storage listing use
-- is_business_public(); owners keep seeing their own businesses in any
-- state through the "owner read own" policies. NOT APPLIED YET.
-- -----------------------------------------------------------------------------

create or replace function public.is_business_public(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.businesses b
                 where b.id = p_business_id and b.is_active and b.verification_status = 'approved')
$$;

-- Public read policies run as anon too, so anon must be able to call it. It
-- only answers whether a business is public, which anyone can observe.
revoke execute on function public.is_business_public(uuid) from public;
grant execute on function public.is_business_public(uuid) to anon, authenticated;

-- 1. Policies ---------------------------------------------------------------------
drop policy if exists "businesses: public read active" on public.businesses;
create policy "businesses: public read active"
  on public.businesses for select
  using (public.is_business_public(id));

drop policy if exists "business_hours: public read active" on public.business_hours;
create policy "business_hours: public read active"
  on public.business_hours for select
  using (public.is_business_public(business_id));

drop policy if exists "promotions: public read active" on public.promotions;
create policy "promotions: public read active"
  on public.promotions for select
  using (is_active and now() between starts_at and ends_at and public.is_business_public(business_id));

drop policy if exists "menu_items: public read available" on public.menu_items;
create policy "menu_items: public read available"
  on public.menu_items for select
  using (is_available and public.is_business_public(business_id));

drop policy if exists "reviews: public read active" on public.reviews;
create policy "reviews: public read active"
  on public.reviews for select
  using (public.is_business_public(business_id));

drop policy if exists "reviews: author insert" on public.reviews;
create policy "reviews: author insert"
  on public.reviews for insert to authenticated
  with check (
    auth.uid() = user_id
    and public.is_business_public(business_id)
    -- Never one's own business.
    and not exists (select 1 from public.businesses b
                    where b.id = business_id and b.owner_id = (select auth.uid()))
  );

-- 2. Reviews with author ------------------------------------------------------------
create or replace view public.reviews_with_author
  with (security_invoker = false, security_barrier = true)
as
select
  r.id,
  r.business_id,
  r.rating,
  r.comment,
  r.created_at,
  r.updated_at,
  p.display_name,
  coalesce(r.user_id = auth.uid(), false) as is_mine
from public.reviews r
left join public.profiles p on p.id = r.user_id
where public.is_business_public(r.business_id);

revoke all on public.reviews_with_author from public, anon, authenticated;
grant select on public.reviews_with_author to anon, authenticated;

-- 3. Storage listing of business pictures ------------------------------------------
-- (The bucket is public: a known object URL is readable regardless of RLS;
-- this policy governs listing through the API.)
drop policy if exists "business-images: public read" on storage.objects;
create policy "business-images: public read"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'business-images'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(objects.name))[1]
        and (public.is_business_public(b.id) or b.owner_id = (select auth.uid()))
    )
  );

notify pgrst, 'reload schema';
