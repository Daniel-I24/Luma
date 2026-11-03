-- -----------------------------------------------------------------------------
-- Migration: owner_sales_daily
-- owner_sales_daily(business, days): for the owner of the business only, the
-- last 7 or 30 days (America/Bogota) as
--   { "days": [{ "day", "orders", "revenue_cop" }, ...]  (every day, zeros too)
--     "top_items": [{ "name", "quantity" }, ...] }       (5 most ordered)
-- Cancelled orders and orders still waiting for their payment are left out.
-- Aggregates only: no customer data.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

create or replace function public.owner_sales_daily(p_business_id uuid, p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := public.app_local_time(now())::date;
  v_from  date;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  if not public.owns_business(p_business_id) then
    raise exception using errcode = '42501', message = 'not_business_owner';
  end if;
  if p_days is null or p_days not in (7, 30) then
    raise exception using errcode = 'P0001', message = 'invalid_range';
  end if;
  v_from := v_today - (p_days - 1);
  return jsonb_build_object(
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'orders', coalesce(s.orders, 0),
                                                   'revenue_cop', coalesce(s.revenue, 0)) order by d.day), '[]')
      from (select generate_series(v_from, v_today, interval '1 day')::date as day) d
      left join (
        select public.app_local_time(o.created_at)::date as day, count(*) as orders, sum(o.total_cop) as revenue
        from public.orders o
        where o.business_id = p_business_id and o.status not in ('cancelled', 'awaiting_payment')
          and public.app_local_time(o.created_at)::date >= v_from
        group by 1
      ) s on s.day = d.day),
    'top_items', (
      select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'quantity', t.quantity) order by t.quantity desc, t.name), '[]')
      from (
        select i.name, sum(i.quantity)::integer as quantity
        from public.order_items i
        join public.orders o on o.id = i.order_id
        where o.business_id = p_business_id and o.status not in ('cancelled', 'awaiting_payment')
          and public.app_local_time(o.created_at)::date >= v_from
        group by i.name
        order by 2 desc, 1
        limit 5
      ) t)
  );
end;
$$;

revoke execute on function public.owner_sales_daily(uuid, integer) from public, anon;
grant execute on function public.owner_sales_daily(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
