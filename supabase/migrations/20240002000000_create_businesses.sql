-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: create_businesses
-- Creates businesses, business_hours, and promotions tables with:
--   - Full RLS: public read of active records, owner-only write.
--   - Spatial indexes on lat/lng for proximity queries.
--   - updated_at auto-maintenance trigger.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. businesses ─────────────────────────────────────────────────────────────
create table if not exists public.businesses (
  id          uuid        not null default gen_random_uuid(),
  owner_id    uuid        not null references auth.users (id) on delete cascade,
  name        text        not null,
  description text,
  category    text        not null,
  logo_url    text,
  cover_url   text,
  latitude    double precision not null,
  longitude   double precision not null,
  address     text        not null,
  phone       text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint businesses_pkey primary key (id)
);

comment on table  public.businesses             is 'Registered businesses visible on the Luma map.';
comment on column public.businesses.owner_id    is 'The auth.users row that owns and manages this business.';
comment on column public.businesses.latitude    is 'WGS-84 latitude; used for proximity queries.';
comment on column public.businesses.longitude   is 'WGS-84 longitude; used for proximity queries.';
comment on column public.businesses.is_active   is 'Only active businesses are shown to end users.';

-- Indexes for geo proximity (separate columns; replace with PostGIS point if available)
create index if not exists businesses_lat_idx  on public.businesses (latitude);
create index if not exists businesses_lng_idx  on public.businesses (longitude);
create index if not exists businesses_owner_idx on public.businesses (owner_id);
create index if not exists businesses_active_idx on public.businesses (is_active);

-- ── 2. business_hours ────────────────────────────────────────────────────────
create table if not exists public.business_hours (
  id           uuid    not null default gen_random_uuid(),
  business_id  uuid    not null references public.businesses (id) on delete cascade,
  -- 0 = Sunday … 6 = Saturday (matches JavaScript Date.getDay())
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  opens_at     time    not null,
  closes_at    time    not null,
  -- true when the business is closed the entire day
  is_closed    boolean not null default false,

  constraint business_hours_pkey       primary key (id),
  constraint business_hours_unique_day unique (business_id, day_of_week)
);

comment on table  public.business_hours             is 'Weekly schedule for each business.';
comment on column public.business_hours.day_of_week is '0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat.';
comment on column public.business_hours.is_closed   is 'When true the business does not open on this day regardless of opens_at/closes_at.';

create index if not exists business_hours_business_idx on public.business_hours (business_id);

-- ── 3. promotions ────────────────────────────────────────────────────────────
create table if not exists public.promotions (
  id           uuid        not null default gen_random_uuid(),
  business_id  uuid        not null references public.businesses (id) on delete cascade,
  title        text        not null,
  description  text,
  image_url    text,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now(),

  constraint promotions_pkey primary key (id)
);

comment on table public.promotions is 'Time-limited promotions published by businesses.';

create index if not exists promotions_business_idx on public.promotions (business_id);
create index if not exists promotions_active_idx   on public.promotions (is_active, starts_at, ends_at);

-- ── 4. updated_at trigger ────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute procedure public.set_updated_at();

-- ── 5. Row Level Security — businesses ───────────────────────────────────────
alter table public.businesses enable row level security;

-- Anyone (including anonymous) can read active businesses.
create policy "businesses: public read active"
  on public.businesses for select
  using (is_active = true);

-- Owners can read their own businesses regardless of is_active.
create policy "businesses: owner read own"
  on public.businesses for select
  using (auth.uid() = owner_id);

-- Only the owner can insert.
create policy "businesses: owner insert"
  on public.businesses for insert
  with check (auth.uid() = owner_id);

-- Only the owner can update.
create policy "businesses: owner update"
  on public.businesses for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Only the owner can delete.
create policy "businesses: owner delete"
  on public.businesses for delete
  using (auth.uid() = owner_id);

-- ── 6. Row Level Security — business_hours ───────────────────────────────────
alter table public.business_hours enable row level security;

-- Public read: hours of active businesses only.
create policy "business_hours: public read active"
  on public.business_hours for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.is_active = true
    )
  );

-- Owner write: insert/update/delete via business ownership.
create policy "business_hours: owner insert"
  on public.business_hours for insert
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
  );

create policy "business_hours: owner update"
  on public.business_hours for update
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_hours.business_id and b.owner_id = auth.uid()
    )
  );

create policy "business_hours: owner delete"
  on public.business_hours for delete
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_hours.business_id and b.owner_id = auth.uid()
    )
  );

-- ── 7. Row Level Security — promotions ───────────────────────────────────────
alter table public.promotions enable row level security;

-- Public read: active promotions of active businesses only.
create policy "promotions: public read active"
  on public.promotions for select
  using (
    is_active = true
    and now() between starts_at and ends_at
    and exists (
      select 1 from public.businesses b
      where b.id = business_id and b.is_active = true
    )
  );

create policy "promotions: owner insert"
  on public.promotions for insert
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_id = auth.uid()
    )
  );

create policy "promotions: owner update"
  on public.promotions for update
  using (
    exists (
      select 1 from public.businesses b
      where b.id = promotions.business_id and b.owner_id = auth.uid()
    )
  );

create policy "promotions: owner delete"
  on public.promotions for delete
  using (
    exists (
      select 1 from public.businesses b
      where b.id = promotions.business_id and b.owner_id = auth.uid()
    )
  );
