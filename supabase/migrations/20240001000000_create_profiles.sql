-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: create_profiles
-- Creates the `profiles` table, enables Row Level Security, and adds a trigger
-- that automatically inserts a profile row when a new user signs up.
--
-- Security notes:
--   - RLS is enabled immediately; no policy = no access.
--   - Each user may only read and update their own row.
--   - INSERT is handled exclusively by the trigger (service role), not by users.
--   - DELETE is intentionally omitted; account deletion goes through
--     the delete-account Edge Function which uses the service_role key.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Table ────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid        not null references auth.users (id) on delete cascade,
  email      text        not null,
  created_at timestamptz not null default now(),

  constraint profiles_pkey primary key (id)
);

comment on table public.profiles  is 'Public profile data for every registered user.';
comment on column public.profiles.id    is 'Matches auth.users.id — one-to-one.';
comment on column public.profiles.email is 'Denormalised email for fast reads; kept in sync via trigger.';

-- 2. Row Level Security ───────────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- Users can read only their own profile.
create policy "profiles: owner can select"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Users can update only their own profile.
create policy "profiles: owner can update"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 3. Auto-create profile on sign-up ──────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

-- Drop the trigger if it already exists (idempotent re-runs).
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();
