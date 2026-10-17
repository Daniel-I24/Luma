-- Minimal Supabase Storage schema for running the migrations and tests on a
-- plain Postgres (local only; a Supabase project already has the real one).
-- Mirrors what the policies use: buckets, objects with RLS, foldername().
create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text not null,
  owner      uuid default auth.uid(),
  metadata   jsonb,
  created_at timestamptz not null default now(),
  unique (bucket_id, name)
);

-- Folders of an object path: 'a/b/c.webp' -> {a,b}.
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;

grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
