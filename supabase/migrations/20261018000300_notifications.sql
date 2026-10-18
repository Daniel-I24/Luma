-- -----------------------------------------------------------------------------
-- Migration: notifications
-- In-app notifications about orders. NOT APPLIED YET: review before running.
--
-- Security notes:
--   - Only the database writes notifications (triggers below); clients have
--     no INSERT privilege and no INSERT policy.
--   - Each user reads and deletes only their own, and may only set read_at
--     on them (column grant + RLS).
--   - No text is stored: the app builds it from type and status with its
--     translations, so nothing user-written travels through here.
--   - The trigger functions are SECURITY DEFINER with an empty search_path
--     and cannot be called by any client role.
-- -----------------------------------------------------------------------------

create table if not exists public.notifications (
  id         uuid        not null default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  type       text        not null constraint notifications_type_valid
    check (type in ('order_status', 'order_new', 'order_cancelled')),
  order_id   uuid        references public.orders (id) on delete cascade,
  status     text        constraint notifications_status_valid check (
    status is null or status in ('pending', 'accepted', 'preparing', 'ready', 'picked_up', 'cancelled')
  ),
  created_at timestamptz not null default now(),
  read_at    timestamptz,

  constraint notifications_pkey primary key (id)
);

comment on table public.notifications is 'Order notifications; written only by triggers, text built by the app.';

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications: owner reads own" on public.notifications;
create policy "notifications: owner reads own"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "notifications: owner marks own" on public.notifications;
create policy "notifications: owner marks own"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "notifications: owner deletes own" on public.notifications;
create policy "notifications: owner deletes own"
  on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.notifications from public, anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- New order: tell the owner of the business.
create or replace function public.notify_order_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, type, order_id, status)
  select b.owner_id, 'order_new', new.id, new.status
  from public.businesses b
  where b.id = new.business_id;
  return new;
end;
$$;

-- Status change made by the business: tell the customer (if the order still
-- has one). Cancelled by the customer: tell the owner of the business.
create or replace function public.notify_order_status_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.user_id is not null and new.user_id = (select auth.uid()) then
    if new.status = 'cancelled' then
      insert into public.notifications (user_id, type, order_id, status)
      select b.owner_id, 'order_cancelled', new.id, new.status
      from public.businesses b
      where b.id = new.business_id;
    end if;
  elsif new.user_id is not null then
    insert into public.notifications (user_id, type, order_id, status)
    values (new.user_id, 'order_status', new.id, new.status);
  end if;
  return new;
end;
$$;

revoke execute on function public.notify_order_created() from public, anon, authenticated;
revoke execute on function public.notify_order_status_changed() from public, anon, authenticated;

drop trigger if exists orders_notify_created on public.orders;
create trigger orders_notify_created
  after insert on public.orders
  for each row execute procedure public.notify_order_created();

drop trigger if exists orders_notify_status on public.orders;
create trigger orders_notify_status
  after update of status on public.orders
  for each row execute procedure public.notify_order_status_changed();

notify pgrst, 'reload schema';
