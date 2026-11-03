-- -----------------------------------------------------------------------------
-- Migration: push_business_id
-- claim_push_batch also returns business_id, so the push data can open the
-- business (promotions) or the owner panel (orders for owners, reviews).
-- The return type changes, so the function is dropped and created again (the
-- migration runs in one transaction) with the same arguments and grants.
-- Depends on 20261027000100_push_dispatch.sql.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

drop function if exists public.claim_push_batch(integer);

create function public.claim_push_batch(p_limit integer default 100)
returns table (notification_id uuid, type text, status text, order_id uuid,
               business_id uuid, business_name text, tokens text[])
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with picked as (
    select n.id from public.notifications n
    where n.pushed_at is null and n.created_at > now() - interval '1 day'
    order by n.created_at
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
    for update skip locked
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
