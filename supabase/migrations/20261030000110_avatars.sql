-- -----------------------------------------------------------------------------
-- Migration: avatars
-- Optional profile photo, never public.
--   1. Private bucket avatars: 2 MB, JPEG, PNG or WebP. Path
--      {user_id}/avatar/{uuid}.{ext}; one object per user (the app deletes
--      the old one before uploading a new one).
--   2. The user uploads, reads and deletes only their own. The owner of a
--      business reads a customer's photo (signed URL) only while that
--      customer has an order there in accepted, preparing or ready, and only
--      if the customer turned show_avatar_to_business on and the photo is
--      the current avatar_path (can_view_customer_avatar, SECURITY DEFINER,
--      used by the Storage policy).
--   3. set_avatar(path, consent): records the photo with its consent time,
--      or clears it (null path) and turns sharing off.
--   delete-account removes the folder with the account.
-- Depends on 20261030000100_customer_profile.sql.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- {uuid}/(avatar)/{uuid}.{ext}; the owner id, or NULL when malformed.
create or replace function public.avatar_owner(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/(avatar)/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}\.(jpg|png|webp)$'
    then split_part(p_name, '/', 1)::uuid
  end
$$;

revoke execute on function public.avatar_owner(text) from public, anon;
grant execute on function public.avatar_owner(text) to authenticated;

-- Objects in the caller's avatar folder (a policy cannot count storage.objects itself).
create or replace function public.avatar_object_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from storage.objects o
  where o.bucket_id = 'avatars' and public.avatar_owner(o.name) = (select auth.uid())
$$;

revoke execute on function public.avatar_object_count() from public, anon;
grant execute on function public.avatar_object_count() to authenticated;

create or replace function public.can_view_customer_avatar(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.orders o on o.user_id = p.id
    join public.businesses b on b.id = o.business_id
    where p.id = public.avatar_owner(p_name)
      and p.avatar_path = p_name
      and p.show_avatar_to_business
      and o.status in ('accepted', 'preparing', 'ready')
      and b.owner_id = (select auth.uid())
  )
$$;

revoke execute on function public.can_view_customer_avatar(text) from public, anon;
grant execute on function public.can_view_customer_avatar(text) to authenticated;

drop policy if exists "avatars: user uploads one" on storage.objects;
create policy "avatars: user uploads one"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and public.avatar_owner(name) = (select auth.uid())
    and public.is_email_confirmed()
    and public.avatar_object_count() = 0
  );

drop policy if exists "avatars: user or serving business reads" on storage.objects;
create policy "avatars: user or serving business reads"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and (public.avatar_owner(name) = (select auth.uid()) or public.can_view_customer_avatar(name))
  );

drop policy if exists "avatars: user deletes own" on storage.objects;
create policy "avatars: user deletes own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.avatar_owner(name) = (select auth.uid()));

-- 3. set_avatar ---------------------------------------------------------------------------
create or replace function public.set_avatar(p_path text, p_consent boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  if p_path is null then
    update public.profiles
    set avatar_path = null, avatar_consent_at = null, show_avatar_to_business = false
    where id = v_user;
    return;
  end if;
  if p_consent is not true then
    raise exception using errcode = 'P0001', message = 'avatar_consent_required';
  end if;
  if public.avatar_owner(p_path) is distinct from v_user
     or not exists (select 1 from storage.objects o where o.bucket_id = 'avatars' and o.name = p_path) then
    raise exception using errcode = 'P0001', message = 'avatar_not_found';
  end if;
  update public.profiles set avatar_path = p_path, avatar_consent_at = now() where id = v_user;
end;
$$;

revoke execute on function public.set_avatar(text, boolean) from public, anon;
grant execute on function public.set_avatar(text, boolean) to authenticated;

notify pgrst, 'reload schema';
