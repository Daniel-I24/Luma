-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: grant_existing_tables
-- Explicit privileges for the tables created before grants were part of every
-- migration (automatic table exposure is disabled in this project).
--
-- Idempotent: each table first loses every privilege of anon/authenticated and
-- then receives exactly what its RLS policies allow. Write privileges are
-- column-scoped so ids, owners, foreign keys and timestamps stay under the
-- database's control (the old UPDATE policies have no WITH CHECK, so without
-- this an owner could move hours or promotions to another business).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── businesses ───────────────────────────────────────────────────────────────
-- Policies: public read of active rows, owners read/insert/update/delete theirs.
revoke all on public.businesses from anon, authenticated;
grant select on public.businesses to anon, authenticated;
grant insert (owner_id, name, description, category, logo_url, cover_url,
              latitude, longitude, address, phone, is_active)
  on public.businesses to authenticated;
grant update (name, description, category, logo_url, cover_url,
              latitude, longitude, address, phone, is_active)
  on public.businesses to authenticated;
grant delete on public.businesses to authenticated;

-- ── business_hours ───────────────────────────────────────────────────────────
-- Policies: public read for active businesses, owners write their own.
revoke all on public.business_hours from anon, authenticated;
grant select on public.business_hours to anon, authenticated;
grant insert (business_id, day_of_week, opens_at, closes_at, is_closed)
  on public.business_hours to authenticated;
grant update (day_of_week, opens_at, closes_at, is_closed)
  on public.business_hours to authenticated;
grant delete on public.business_hours to authenticated;

-- ── promotions ───────────────────────────────────────────────────────────────
-- Policies: public read of active, current promotions; owners write their own.
revoke all on public.promotions from anon, authenticated;
grant select on public.promotions to anon, authenticated;
grant insert (business_id, title, description, image_url, starts_at, ends_at, is_active)
  on public.promotions to authenticated;
grant update (title, description, image_url, starts_at, ends_at, is_active)
  on public.promotions to authenticated;
grant delete on public.promotions to authenticated;

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Policies: users read and update only their own row. Rows are created by the
-- sign-up trigger and deleted by the delete-account Edge Function, so there is
-- no INSERT/DELETE for clients, nothing for anon, and only display_name is
-- writable (never email).
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

notify pgrst, 'reload schema';
