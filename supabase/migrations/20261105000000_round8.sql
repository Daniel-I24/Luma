-- -----------------------------------------------------------------------------
-- Migration: round8 (pending review, depends on 20261104000000_round7)
--   1. send_test_notification is for admins only ("Probar mi dispositivo" in
--      their panel); customers and owners no longer see a test button.
--   2. app_settings.show_pending_businesses (0 by default). With 1, a
--      published business already sent to review ('pending': it passed
--      submit_business_for_review, so its required data is complete) is
--      public with the "En verificacion" badge, pick-up payment only. A draft
--      is never public; rejected and suspended disappear.
-- NOT APPLIED YET. SQL comments in ASCII.
-- -----------------------------------------------------------------------------

-- 1. Test notification: admins only ---------------------------------------------------
create or replace function public.send_test_notification()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not_admin';
  end if;
  if not public.hit_rate_limit('push_test') then
    raise exception using errcode = 'P0001', message = 'rate_limited';
  end if;
  insert into public.notifications (user_id, type) values (auth.uid(), 'test');
end;
$$;

revoke execute on function public.send_test_notification() from public, anon;
grant execute on function public.send_test_notification() to authenticated;

-- 2. Pending businesses, when the team allows it ----------------------------------------
insert into public.app_settings (key, int_value) values ('show_pending_businesses', 0)
on conflict (key) do nothing;

-- Every public read (businesses, hours, menu, promotions, reviews, pictures)
-- goes through this function, so the setting reaches all of them at once.
create or replace function public.is_business_public(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.is_active
      and (b.verification_status = 'approved'
           or (b.verification_status = 'pending'
               and coalesce((select s.int_value from public.app_settings s where s.key = 'show_pending_businesses'), 0) = 1))
  )
$$;

revoke execute on function public.is_business_public(uuid) from public;
grant execute on function public.is_business_public(uuid) to anon, authenticated;

-- A business still in review takes orders paid at pick-up only.
create or replace function private.orders_online_needs_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_method = 'online'
     and not exists (select 1 from public.businesses b where b.id = new.business_id and b.verification_status = 'approved') then
    raise exception using errcode = 'P0001', message = 'online_payment_unavailable';
  end if;
  return new;
end;
$$;

revoke execute on function private.orders_online_needs_approval() from public, anon, authenticated;

drop trigger if exists orders_online_needs_approval on public.orders;
create trigger orders_online_needs_approval
  before insert on public.orders
  for each row execute procedure private.orders_online_needs_approval();

notify pgrst, 'reload schema';
