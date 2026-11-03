-- -----------------------------------------------------------------------------
-- Migration: round9 (pending review, depends on 20261105000000_round8)
--   1. review_business: approving a business in review also publishes it
--      (is_active = true) when it already has an open day and an available
--      product, the same rule as businesses_guard_publish. Otherwise it stays
--      hidden and the owner's summary says what is missing. The owner can
--      pause it afterwards; a re-approval after a suspension never touches
--      is_active (the owner's choice stays).
--   2. The only visible rule is max_businesses_per_owner (3). The daily
--      creation limit becomes an internal guard of 10 a day.
--   3. Realtime without rows: two event tables with ids and a time only.
--      catalog_events (kind, business_id, at): readable by anyone, written
--      by triggers when a public business, its hours, menu or promotions
--      change (or a business becomes public / stops being public).
--      order_events (order_id, user_id, business_id, at): the order's
--      customer and the business owner read it (RLS); written by triggers
--      of orders, and of notifications with order_id null ("your inbox
--      changed"). Both pruned after a day. The supabase_realtime
--      publication carries exactly these two tables: no private column
--      ever leaves through Realtime; the app re-reads with normal queries.
-- NOT APPLIED YET. SQL comments in ASCII.
-- -----------------------------------------------------------------------------

-- 1. Approving publishes when it can ---------------------------------------------------
create or replace function private.meets_publish_requirements(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.business_hours h where h.business_id = p_business_id and not h.is_closed)
     and exists (select 1 from public.menu_items m where m.business_id = p_business_id and m.is_available)
$$;

revoke execute on function private.meets_publish_requirements(uuid) from public, anon, authenticated;

create or replace function public.review_business(
  p_business_id uuid, p_decision text, p_note text, p_seen_updated_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_owner uuid;
  v_updated timestamptz;
  v_note text := nullif(btrim(p_note), '');
  v_publish boolean;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  if p_decision not in ('approved', 'rejected', 'suspended') then
    raise exception using errcode = 'P0001', message = 'invalid_decision';
  end if;
  if p_decision in ('rejected', 'suspended') and v_note is null then
    raise exception using errcode = 'P0001', message = 'note_required';
  end if;
  select verification_status, owner_id, updated_at into v_status, v_owner, v_updated
  from public.businesses where id = p_business_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'business_not_found';
  end if;
  if v_updated is distinct from p_seen_updated_at then
    raise exception using errcode = 'P0001', message = 'stale_review';
  end if;
  if (v_status, p_decision) not in (
    ('pending', 'approved'), ('pending', 'rejected'), ('pending', 'suspended'),
    ('approved', 'suspended'), ('suspended', 'approved')
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_transition';
  end if;
  if p_decision = 'approved' and public.tax_id_taken(p_business_id) then
    raise exception using errcode = 'P0001', message = 'tax_id_in_use';
  end if;
  v_publish := v_status = 'pending' and p_decision = 'approved'
               and private.meets_publish_requirements(p_business_id);
  update public.businesses
  set verification_status = p_decision,
      verification_note = case when p_decision = 'approved' then null else left(v_note, 300) end,
      verified_at = case when p_decision = 'approved' then now() else verified_at end,
      is_active = case when v_publish then true else is_active end
  where id = p_business_id;
  insert into public.notifications (user_id, type, business_id, status)
  values (v_owner, 'business_review', p_business_id, p_decision);
  perform public.log_admin_action('review_business', 'business', p_business_id, p_decision);
end;
$$;

revoke execute on function public.review_business(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.review_business(uuid, text, text, timestamptz) to authenticated;

-- 2. Businesses per owner: 3 is the rule, 10 creations a day an internal guard ------------
update public.app_settings set int_value = 10
where key = 'rate_business_create_max' and int_value = 3;

-- 3. Realtime event tables ---------------------------------------------------------------
create table if not exists public.catalog_events (
  id          bigint generated always as identity primary key,
  kind        text        not null constraint catalog_events_kind check (kind in ('business', 'hours', 'menu', 'promotion')),
  business_id uuid        not null,
  at          timestamptz not null default now()
);
create index if not exists catalog_events_at on public.catalog_events (at);
alter table public.catalog_events enable row level security;
revoke all on public.catalog_events from public, anon, authenticated;
grant select on public.catalog_events to anon, authenticated;
drop policy if exists catalog_events_read on public.catalog_events;
create policy catalog_events_read on public.catalog_events for select to anon, authenticated using (true);

create table if not exists public.order_events (
  id          bigint generated always as identity primary key,
  order_id    uuid,
  user_id     uuid,
  business_id uuid,
  at          timestamptz not null default now()
);
create index if not exists order_events_at on public.order_events (at);
create index if not exists order_events_user on public.order_events (user_id);
create index if not exists order_events_business on public.order_events (business_id);
alter table public.order_events enable row level security;
revoke all on public.order_events from public, anon, authenticated;
grant select on public.order_events to authenticated;
drop policy if exists order_events_read on public.order_events;
create policy order_events_read on public.order_events for select to authenticated using (
  user_id = (select auth.uid())
  or (business_id is not null and exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid())))
);

-- Public as is_business_public decides, from the columns of a row (old or new).
create or replace function private.is_visible(p_active boolean, p_status text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_active, false) and (p_status = 'approved' or (p_status = 'pending'
    and coalesce((select s.int_value from public.app_settings s where s.key = 'show_pending_businesses'), 0) = 1))
$$;
revoke execute on function private.is_visible(boolean, text) from public, anon, authenticated;

create or replace function private.businesses_catalog_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before boolean := tg_op <> 'INSERT' and private.is_visible(old.is_active, old.verification_status);
  v_after boolean := tg_op <> 'DELETE' and private.is_visible(new.is_active, new.verification_status);
begin
  -- Drafts and hidden businesses never make events; an edit that only
  -- touches updated_at is no change.
  if (v_before or v_after) and (tg_op <> 'UPDATE'
      or (to_jsonb(old) - 'updated_at') is distinct from (to_jsonb(new) - 'updated_at')) then
    insert into public.catalog_events (kind, business_id)
    values ('business', case when tg_op = 'DELETE' then old.id else new.id end);
  end if;
  return null;
end;
$$;
revoke execute on function private.businesses_catalog_event() from public, anon, authenticated;
drop trigger if exists businesses_catalog_event on public.businesses;
create trigger businesses_catalog_event after insert or update or delete on public.businesses
  for each row execute procedure private.businesses_catalog_event();

-- Hours, menu and promotions of a public business (tg_argv[0] is the kind).
create or replace function private.child_catalog_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid := case when tg_op = 'DELETE' then old.business_id else new.business_id end;
begin
  if public.is_business_public(v_business) then
    insert into public.catalog_events (kind, business_id) values (tg_argv[0], v_business);
  end if;
  return null;
end;
$$;
revoke execute on function private.child_catalog_event() from public, anon, authenticated;
drop trigger if exists business_hours_catalog_event on public.business_hours;
create trigger business_hours_catalog_event after insert or update or delete on public.business_hours
  for each row execute procedure private.child_catalog_event('hours');
drop trigger if exists menu_items_catalog_event on public.menu_items;
create trigger menu_items_catalog_event after insert or update or delete on public.menu_items
  for each row execute procedure private.child_catalog_event('menu');
drop trigger if exists promotions_catalog_event on public.promotions;
create trigger promotions_catalog_event after insert or update or delete on public.promotions
  for each row execute procedure private.child_catalog_event('promotion');

create or replace function private.orders_order_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_events (order_id, user_id, business_id) values (new.id, new.user_id, new.business_id);
  return null;
end;
$$;
revoke execute on function private.orders_order_event() from public, anon, authenticated;
drop trigger if exists orders_order_event on public.orders;
create trigger orders_order_event after insert or update on public.orders
  for each row execute procedure private.orders_order_event();

create or replace function private.notifications_order_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_events (order_id, user_id, business_id) values (null, new.user_id, null);
  return null;
end;
$$;
revoke execute on function private.notifications_order_event() from public, anon, authenticated;
drop trigger if exists notifications_order_event on public.notifications;
create trigger notifications_order_event after insert or update of read_at on public.notifications
  for each row execute procedure private.notifications_order_event();

-- Events older than a day are of no use to anyone.
create or replace function private.prune_realtime_events()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.catalog_events where at < now() - interval '1 day';
  delete from public.order_events where at < now() - interval '1 day';
$$;
revoke execute on function private.prune_realtime_events() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'luma-prune-realtime-events';
    perform cron.schedule('luma-prune-realtime-events', '17 * * * *', 'select private.prune_realtime_events()');
  end if;
end;
$$;

-- The publication carries exactly the two event tables.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables) then
    drop publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;
alter publication supabase_realtime set table public.catalog_events, public.order_events;

notify pgrst, 'reload schema';
