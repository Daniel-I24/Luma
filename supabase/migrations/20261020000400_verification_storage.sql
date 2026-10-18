-- -----------------------------------------------------------------------------
-- Migration: verification_storage
-- Private bucket for verification documents (RUT, facade photo, others).
-- NOT APPLIED YET.
--   - 5 MB per file; JPEG, PNG, WebP or PDF.
--   - Path {business_id}/{rut|facade|other}/{uuid}.{ext}.
--   - The owner uploads, reads and deletes only while the business is in
--     draft or rejected (reads: always their own); admins read and delete.
--     Nobody else, and the bucket is private (signed URLs only).
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-docs', 'verification-docs', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- {uuid}/{kind}/{uuid}.{ext}; returns the business id or NULL when malformed.
create or replace function public.verification_doc_business(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/(rut|facade|other)/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}\.(jpg|png|webp|pdf)$'
    then split_part(p_name, '/', 1)::uuid
  end
$$;

revoke execute on function public.verification_doc_business(text) from public, anon;
grant execute on function public.verification_doc_business(text) to authenticated;

drop policy if exists "verification-docs: owner uploads while editable" on storage.objects;
create policy "verification-docs: owner uploads while editable"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verification-docs'
    and public.owns_editable_business(public.verification_doc_business(name))
  );

drop policy if exists "verification-docs: owner or admin reads" on storage.objects;
create policy "verification-docs: owner or admin reads"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and (public.owns_business(public.verification_doc_business(name)) or public.is_admin())
  );

drop policy if exists "verification-docs: owner while editable or admin deletes" on storage.objects;
create policy "verification-docs: owner while editable or admin deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'verification-docs'
    and (public.owns_editable_business(public.verification_doc_business(name)) or public.is_admin())
  );

notify pgrst, 'reload schema';
