-- -----------------------------------------------------------------------------
-- Migration: business_showcase
-- What a business shows to customers beyond its basics.
--   1. Public contact: whatsapp (+573XXXXXXXXX), instagram (user name),
--      facebook (page identifier) and website (https only), with CHECKs and
--      column grants for the owner.
--   2. business_photos: gallery of the place, at most 8 per business; files at
--      business-images/{business_id}/gallery/{uuid}.{ext} (path rule and the
--      80-files cap live in 20261018000100_business_images.sql). Public when
--      the business is public; the owner reads and writes their own.
--   3. menu_items: at most 200 per business.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

-- 1. Contact ----------------------------------------------------------------------
alter table public.businesses
  add column if not exists whatsapp text
    constraint businesses_whatsapp_co_mobile check (whatsapp is null or whatsapp ~ '^\+573[0-9]{9}$'),
  add column if not exists instagram text
    constraint businesses_instagram_handle check (instagram is null or instagram ~ '^[a-z0-9._]{1,30}$'),
  add column if not exists facebook text
    constraint businesses_facebook_page check (facebook is null or facebook ~ '^[A-Za-z0-9.-]{2,80}$'),
  add column if not exists website text
    constraint businesses_website_https check (
      website is null or (website ~* '^https://[^\s/$.?#][^\s]*$' and char_length(website) <= 200));

grant insert (whatsapp, instagram, facebook, website),
      update (whatsapp, instagram, facebook, website)
  on public.businesses to authenticated;

-- 2. Gallery ----------------------------------------------------------------------
create table if not exists public.business_photos (
  id           uuid        not null default gen_random_uuid(),
  business_id  uuid        not null references public.businesses (id) on delete cascade,
  storage_path text        not null,
  caption      text        constraint business_photos_caption_length check (caption is null or char_length(caption) <= 60),
  sort_order   smallint    not null default 0 constraint business_photos_sort_range check (sort_order between 0 and 99),
  created_at   timestamptz not null default now(),
  constraint business_photos_pkey primary key (id),
  constraint business_photos_path_unique unique (storage_path),
  -- The file must be in this business's gallery folder.
  constraint business_photos_path_shape check (
    storage_path ~ ('^' || business_id::text || '/gallery/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}\.(jpg|png|webp)$'))
);

create index if not exists business_photos_business_idx on public.business_photos (business_id, sort_order);

alter table public.business_photos enable row level security;

-- Two read policies: owns_business is not executable by anon.
drop policy if exists "business_photos: public read" on public.business_photos;
create policy "business_photos: public read"
  on public.business_photos for select to anon, authenticated
  using (public.is_business_public(business_id));

drop policy if exists "business_photos: owner read" on public.business_photos;
create policy "business_photos: owner read"
  on public.business_photos for select to authenticated
  using (public.owns_business(business_id));

drop policy if exists "business_photos: owner insert" on public.business_photos;
create policy "business_photos: owner insert"
  on public.business_photos for insert to authenticated
  with check (public.owns_business(business_id));

drop policy if exists "business_photos: owner update" on public.business_photos;
create policy "business_photos: owner update"
  on public.business_photos for update to authenticated
  using (public.owns_business(business_id)) with check (public.owns_business(business_id));

drop policy if exists "business_photos: owner delete" on public.business_photos;
create policy "business_photos: owner delete"
  on public.business_photos for delete to authenticated
  using (public.owns_business(business_id));

revoke all on public.business_photos from public, anon, authenticated;
grant select on public.business_photos to anon, authenticated;
grant insert (business_id, storage_path, caption, sort_order) on public.business_photos to authenticated;
grant update (caption, sort_order) on public.business_photos to authenticated;
grant delete on public.business_photos to authenticated;

-- 3. Caps per business (gallery 8, menu 200), one creation at a time ------------------
create or replace function public.business_content_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || new.business_id::text, 0));
  if tg_table_name = 'business_photos' then
    select count(*) into v_count from public.business_photos p where p.business_id = new.business_id;
    if v_count >= 8 then
      raise exception using errcode = 'P0001', message = 'gallery_limit';
    end if;
  else
    select count(*) into v_count from public.menu_items m where m.business_id = new.business_id;
    if v_count >= 200 then
      raise exception using errcode = 'P0001', message = 'menu_limit';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.business_content_limits() from public, anon, authenticated;

drop trigger if exists business_photos_limit on public.business_photos;
create trigger business_photos_limit
  before insert on public.business_photos
  for each row execute function public.business_content_limits();

drop trigger if exists menu_items_limit on public.menu_items;
create trigger menu_items_limit
  before insert on public.menu_items
  for each row execute function public.business_content_limits();

notify pgrst, 'reload schema';
