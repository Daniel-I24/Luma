-- -----------------------------------------------------------------------------
-- Migration: business_images
-- Public bucket for business pictures (logo, cover, menu, promotions).
-- NOT APPLIED YET: review before running.
--
-- Security notes:
--   - Objects live at {business_id}/{kind}/{uuid}.{ext}, kind in logo, cover,
--     menu, promotions. Only the owner of that business may insert, update
--     or delete them; the path shape is enforced too.
--   - 2 MB per file and only JPEG, PNG or WebP (bucket limits, checked by
--     Storage before writing). The app re-encodes images before uploading,
--     which also drops EXIF metadata such as the GPS position.
--   - Anyone may read: the pictures are public content of published or
--     draft businesses; names carry no personal data.
--   - Image URL columns only accept https (existing rows: NOT VALID).
-- -----------------------------------------------------------------------------

-- 1. Bucket --------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-images', 'business-images', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. Policies on storage.objects -----------------------------------------------
-- True when the object path is {uuid of a business the caller owns}/{kind}/{file}.
create or replace function public.can_write_business_image(p_name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_name ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/(logo|cover|menu|promotions)/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}\.(jpg|png|webp)$'
     and exists (
       select 1 from public.businesses b
       where b.id::text = (storage.foldername(p_name))[1]
         and b.owner_id = (select auth.uid())
     );
$$;

revoke execute on function public.can_write_business_image(text) from public, anon;
grant execute on function public.can_write_business_image(text) to authenticated;

drop policy if exists "business-images: public read" on storage.objects;
create policy "business-images: public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'business-images');

drop policy if exists "business-images: owner insert" on storage.objects;
create policy "business-images: owner insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'business-images' and public.can_write_business_image(name));

drop policy if exists "business-images: owner update" on storage.objects;
create policy "business-images: owner update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'business-images' and public.can_write_business_image(name))
  with check (bucket_id = 'business-images' and public.can_write_business_image(name));

drop policy if exists "business-images: owner delete" on storage.objects;
create policy "business-images: owner delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'business-images' and public.can_write_business_image(name));

-- 3. https only for image URLs ---------------------------------------------------
alter table public.businesses
  add constraint businesses_logo_url_https
    check (logo_url is null or logo_url ~* '^https://') not valid,
  add constraint businesses_cover_url_https
    check (cover_url is null or cover_url ~* '^https://') not valid;

alter table public.promotions
  add constraint promotions_image_url_https
    check (image_url is null or image_url ~* '^https://') not valid;

notify pgrst, 'reload schema';
