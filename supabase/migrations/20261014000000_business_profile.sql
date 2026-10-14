-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: business_profile
-- Data for the business profile: menu items, favourites, reviews, the user's
-- display name and two read-only views (ratings, reviews with author).
--
-- Security notes:
--   - RLS on every new table; no policy = no access.
--   - Automatic table exposure is disabled in this project, so every object
--     gets explicit GRANTs, limited to what the policies allow.
--   - Money is stored as whole Colombian pesos (integer), never floats.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. menu_items ────────────────────────────────────────────────────────────
create table if not exists public.menu_items (
  id           uuid        not null default gen_random_uuid(),
  business_id  uuid        not null references public.businesses (id) on delete cascade,
  name         text        not null check (char_length(name) between 1 and 80),
  description  text        check (description is null or char_length(description) <= 300),
  price_cop    integer     not null check (price_cop >= 0),
  image_url    text,
  section      text        check (section is null or char_length(section) <= 40),
  sort_order   integer     not null default 0,
  is_available boolean     not null default true,
  created_at   timestamptz not null default now(),

  constraint menu_items_pkey primary key (id)
);

comment on table  public.menu_items           is 'Products a business sells (its menu).';
comment on column public.menu_items.price_cop is 'Price in whole Colombian pesos; integers only, never decimals.';
comment on column public.menu_items.section   is 'Menu section the item is listed under (e.g. "Bebidas").';

create index if not exists menu_items_business_idx on public.menu_items (business_id, sort_order);

alter table public.menu_items enable row level security;

-- Anyone can read available items of active businesses.
create policy "menu_items: public read available"
  on public.menu_items for select
  using (
    is_available = true
    and exists (select 1 from public.businesses b where b.id = business_id and b.is_active = true)
  );

-- The owner reads all their items, including unavailable ones.
create policy "menu_items: owner read own"
  on public.menu_items for select
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

create policy "menu_items: owner insert"
  on public.menu_items for insert
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

create policy "menu_items: owner update"
  on public.menu_items for update
  using (exists (select 1 from public.businesses b where b.id = menu_items.business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = menu_items.business_id and b.owner_id = auth.uid()));

create policy "menu_items: owner delete"
  on public.menu_items for delete
  using (exists (select 1 from public.businesses b where b.id = menu_items.business_id and b.owner_id = auth.uid()));

-- ── 2. favorites ─────────────────────────────────────────────────────────────
create table if not exists public.favorites (
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  business_id uuid        not null references public.businesses (id) on delete cascade,
  created_at  timestamptz not null default now(),

  constraint favorites_pkey primary key (user_id, business_id)
);

comment on table public.favorites is 'Businesses each user saved as favourite. Private to that user.';

create index if not exists favorites_business_idx on public.favorites (business_id);

alter table public.favorites enable row level security;

create policy "favorites: owner select"
  on public.favorites for select to authenticated
  using (auth.uid() = user_id);

create policy "favorites: owner insert"
  on public.favorites for insert to authenticated
  with check (auth.uid() = user_id);

create policy "favorites: owner delete"
  on public.favorites for delete to authenticated
  using (auth.uid() = user_id);

-- ── 3. reviews ───────────────────────────────────────────────────────────────
create table if not exists public.reviews (
  id          uuid        not null default gen_random_uuid(),
  business_id uuid        not null references public.businesses (id) on delete cascade,
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  rating      smallint    not null check (rating between 1 and 5),
  comment     text        check (comment is null or char_length(comment) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint reviews_pkey primary key (id),
  constraint reviews_one_per_user unique (user_id, business_id)
);

comment on table public.reviews is 'One rating (1–5) and optional comment per user and business.';

create index if not exists reviews_business_idx on public.reviews (business_id, created_at desc);

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute procedure public.set_updated_at();

alter table public.reviews enable row level security;

-- Anyone can read reviews of active businesses.
create policy "reviews: public read active"
  on public.reviews for select
  using (exists (select 1 from public.businesses b where b.id = business_id and b.is_active = true));

-- Authors always see their own reviews.
create policy "reviews: author read own"
  on public.reviews for select to authenticated
  using (auth.uid() = user_id);

-- Users review active businesses they do not own; never in someone else's name.
create policy "reviews: author insert"
  on public.reviews for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.businesses b
      where b.id = business_id and b.is_active = true and b.owner_id <> auth.uid()
    )
  );

create policy "reviews: author update"
  on public.reviews for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "reviews: author delete"
  on public.reviews for delete to authenticated
  using (auth.uid() = user_id);

-- ── 4. profiles.display_name ─────────────────────────────────────────────────
alter table public.profiles
  add column if not exists display_name text
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) <= 40);

comment on column public.profiles.display_name is 'Optional public name shown next to the user''s reviews.';

-- ── 5. Views ─────────────────────────────────────────────────────────────────
-- Safe because it runs with the caller's rights (security_invoker): it only
-- aggregates reviews the caller can already read under the reviews RLS, and
-- it exposes nothing but counts and averages per business.
create or replace view public.business_ratings
  with (security_invoker = true)
as
select
  r.business_id,
  round(avg(r.rating)::numeric, 1) as average_rating,
  count(*)::integer                as review_count
from public.reviews r
group by r.business_id;

comment on view public.business_ratings is 'Average rating (one decimal) and review count per business.';

-- Safe although it runs with the owner's rights (needed: profiles RLS only lets
-- users read their own row, so the author name would always be null):
--   - it repeats the public filter of the reviews table (active businesses);
--   - it selects explicit columns only: the review plus profiles.display_name.
--     It never exposes email, any other profiles column or the author's
--     user_id; is_mine (computed from the caller's JWT) is all the UI needs
--     to recognise the caller's own review;
--   - security_barrier stops callers' predicates from running before that filter.
drop view if exists public.reviews_with_author;
create view public.reviews_with_author
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
join public.businesses b on b.id = r.business_id and b.is_active = true
left join public.profiles p on p.id = r.user_id;

comment on view public.reviews_with_author is 'Public reviews with the author''s display name; no other profile data.';

-- ── 6. Grants ────────────────────────────────────────────────────────────────
revoke all on public.menu_items, public.favorites, public.reviews from anon, authenticated;
revoke all on public.business_ratings, public.reviews_with_author from anon, authenticated;

grant select on public.menu_items to anon, authenticated;
grant insert, update, delete on public.menu_items to authenticated;

grant select, insert, delete on public.favorites to authenticated;

grant select on public.reviews to anon, authenticated;
-- Column lists keep user_id, ids and timestamps under the database's control:
-- updated_at is only ever written by the reviews_set_updated_at trigger.
grant insert (business_id, rating, comment) on public.reviews to authenticated;
grant update (rating, comment) on public.reviews to authenticated;
grant delete on public.reviews to authenticated;

-- A column grant does not narrow an existing table-wide UPDATE, so drop that
-- first: the "owner can update" policy would otherwise let users change email.
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select on public.business_ratings, public.reviews_with_author to anon, authenticated;

notify pgrst, 'reload schema';
