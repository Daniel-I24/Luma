-- -----------------------------------------------------------------------------
-- Migration: push_claim_window
-- claim_push_batch no longer consumes notices of users without a device token:
-- they wait, so the phone that links its token a moment later still gets them.
--   1. app_settings push_claim_window_minutes (60): a notice older than this is
--      news no longer: it is marked as pushed without being sent (it stays in
--      the in-app list). Replaces the fixed one-day limit.
--   2. Only notices of users with a token are claimed; consent is still checked
--      at send time, so a refused notice is consumed and never sent later.
-- Same arguments, return type and grants as 20261029000000_push_business_id.sql.
-- Without pg_cron a waiting notice goes out with the next notification's poke.
-- -----------------------------------------------------------------------------

insert into public.app_settings (key, int_value) values ('push_claim_window_minutes', 60)
on conflict (key) do nothing;

create or replace function public.claim_push_batch(p_limit integer default 100)
returns table (notification_id uuid, type text, status text, order_id uuid,
               business_id uuid, business_name text, tokens text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit  integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_oldest timestamptz := now() - make_interval(mins => coalesce(
    (select s.int_value from public.app_settings s where s.key = 'push_claim_window_minutes'), 60));
begin
  update public.notifications n set pushed_at = now()
  where n.id in (
    select o.id from public.notifications o
    where o.pushed_at is null and o.created_at <= v_oldest
    order by o.created_at
    limit v_limit
    for update skip locked
  );

  return query
  with picked as (
    select n.id from public.notifications n
    where n.pushed_at is null and n.created_at > v_oldest
      and exists (select 1 from public.device_tokens t where t.user_id = n.user_id)
    order by n.created_at
    limit v_limit
    for update of n skip locked
  ), marked as (
    update public.notifications n set pushed_at = now()
    from picked where n.id = picked.id
    returning n.id, n.user_id, n.type, n.status, n.order_id, n.business_id
  )
  select m.id, m.type, m.status, m.order_id,
         coalesce(m.business_id, o.business_id),
         coalesce(o.business_name, b.name),
         array_agg(d.token order by d.last_seen_at desc)
  from marked m
  join public.profiles pr on pr.id = m.user_id
  join public.device_tokens d on d.user_id = m.user_id
  left join public.orders o on o.id = m.order_id
  left join public.businesses b on b.id = m.business_id
  where case m.type
          when 'promotion' then pr.notify_promotions
          when 'business_review' then true
          else pr.notify_orders
        end
  group by m.id, m.type, m.status, m.order_id, m.business_id, o.business_id, o.business_name, b.name;
end;
$$;

revoke execute on function public.claim_push_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_push_batch(integer) to service_role;

notify pgrst, 'reload schema';
