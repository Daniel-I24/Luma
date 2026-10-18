-- -----------------------------------------------------------------------------
-- Migration: ai_gateway
-- Server side of Luma IA (Edge Functions recommend and suggest-promotions).
--   1. ai_usage and ai_cache: closed tables (RLS on, no client grants).
--   2. consume_ai_quota: daily limits per user, per business and global
--      (app_settings), counted only when every limit still has room.
--   3. ai_cache_get / ai_cache_put: service_role only, so a client can never
--      plant an answer for other users; TTL capped at 24 h.
--   4. ai_recommend_candidates: public businesses open at a time near a point
--      (rounded coordinates), with rating, current promotions and up to 4
--      available items. Public data only.
--   5. owner_sales_summary: aggregates of the last 60 days of one business,
--      only for its owner; never ids or data of customers.
-- NOT APPLIED YET.
-- -----------------------------------------------------------------------------

-- 1. Tables ----------------------------------------------------------------------
create table if not exists public.ai_usage (
  day     date    not null,
  scope   text    not null constraint ai_usage_scope_valid check (scope in ('user', 'business', 'global')),
  subject uuid    not null,
  calls   integer not null default 0 constraint ai_usage_calls_non_negative check (calls >= 0),
  constraint ai_usage_pkey primary key (day, scope, subject)
);

create table if not exists public.ai_cache (
  key        text        not null constraint ai_cache_key_length check (char_length(key) between 8 and 128),
  value      jsonb       not null constraint ai_cache_value_size check (pg_column_size(value) <= 16384),
  expires_at timestamptz not null,
  constraint ai_cache_pkey primary key (key)
);

create index if not exists ai_cache_expires_idx on public.ai_cache (expires_at);

alter table public.ai_usage enable row level security;
alter table public.ai_cache enable row level security;
revoke all on public.ai_usage, public.ai_cache from public, anon, authenticated;

insert into public.app_settings (key, int_value) values
  ('ai_daily_per_user', 20),
  ('ai_daily_per_business', 10),
  ('ai_daily_global', 500)
on conflict (key) do nothing;

-- 2. Quotas ------------------------------------------------------------------------
-- p_business_id: the business an owner asks about (its own quota too).
create or replace function public.consume_ai_quota(p_business_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_day   date := (now() at time zone 'America/Bogota')::date;
  v_zero  uuid := '00000000-0000-0000-0000-000000000000';
  v_limit integer;
begin
  if v_user is null then
    raise exception using errcode = '28000', message = 'not_authenticated';
  end if;
  if p_business_id is not null and not public.owns_business(p_business_id) then
    raise exception using errcode = '42501', message = 'not_business_owner';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ai_quota', 0));
  -- Every limit must have room; only then are the counters raised.
  select coalesce((select int_value from public.app_settings where key = 'ai_daily_per_user'), 20) into v_limit;
  if coalesce((select calls from public.ai_usage where day = v_day and scope = 'user' and subject = v_user), 0) >= v_limit then
    return false;
  end if;
  if p_business_id is not null then
    select coalesce((select int_value from public.app_settings where key = 'ai_daily_per_business'), 10) into v_limit;
    if coalesce((select calls from public.ai_usage where day = v_day and scope = 'business' and subject = p_business_id), 0) >= v_limit then
      return false;
    end if;
  end if;
  select coalesce((select int_value from public.app_settings where key = 'ai_daily_global'), 500) into v_limit;
  if coalesce((select calls from public.ai_usage where day = v_day and scope = 'global' and subject = v_zero), 0) >= v_limit then
    return false;
  end if;

  insert into public.ai_usage (day, scope, subject, calls)
  select v_day, s.scope, s.subject, 1
  from (values ('user', v_user), ('global', v_zero), ('business', p_business_id)) as s(scope, subject)
  where s.subject is not null
  on conflict (day, scope, subject) do update set calls = public.ai_usage.calls + 1;
  return true;
end;
$$;

revoke execute on function public.consume_ai_quota(uuid) from public, anon;
grant execute on function public.consume_ai_quota(uuid) to authenticated;

-- 3. Cache (service_role only) -----------------------------------------------------
create or replace function public.ai_cache_get(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select c.value from public.ai_cache c where c.key = p_key and c.expires_at > now()
$$;

create or replace function public.ai_cache_put(p_key text, p_value jsonb, p_ttl_seconds integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.ai_cache where expires_at <= now();
  insert into public.ai_cache (key, value, expires_at)
  values (p_key, p_value, now() + make_interval(secs => least(greatest(p_ttl_seconds, 60), 86400)))
  on conflict (key) do update set value = excluded.value, expires_at = excluded.expires_at;
end;
$$;

revoke execute on function public.ai_cache_get(text) from public, anon, authenticated;
revoke execute on function public.ai_cache_put(text, jsonb, integer) from public, anon, authenticated;
grant execute on function public.ai_cache_get(text) to service_role;
grant execute on function public.ai_cache_put(text, jsonb, integer) to service_role;

-- 4. Candidates for recommend ------------------------------------------------------
create or replace function public.ai_recommend_candidates(
  p_lat double precision, p_lng double precision, p_radius_km double precision, p_at timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with near as (
    select b.id, b.name, b.category, b.prep_minutes,
           6371 * 2 * asin(sqrt(power(sin(radians(b.latitude - round(p_lat::numeric, 2)::float8) / 2), 2)
             + cos(radians(round(p_lat::numeric, 2)::float8)) * cos(radians(b.latitude))
             * power(sin(radians(b.longitude - round(p_lng::numeric, 2)::float8) / 2), 2))) as km
    from public.businesses b
    where public.is_business_public(b.id) and public.business_open_at(b.id, p_at)
  )
  select coalesce(jsonb_agg(c order by c.km), '[]'::jsonb)
  from (
    select n.id, n.name, n.category, round(n.km::numeric, 1) as km,
           (select r.average_rating from public.business_ratings r where r.business_id = n.id) as rating,
           (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'menu_item_id', p.menu_item_id,
                     'discount_percent', p.discount_percent)), '[]'::jsonb)
            from public.promotions p
            where p.business_id = n.id and p.is_active and p_at between p.starts_at and p.ends_at) as promotions,
           (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'price_cop', m.price_cop,
                     'section', m.section) order by m.sort_order, m.id), '[]'::jsonb)
            from (select * from public.menu_items mi
                  where mi.business_id = n.id and mi.is_available
                  order by mi.sort_order, mi.id limit 4) m) as items
    from near n
    where n.km <= least(greatest(p_radius_km, 0.5), 10)
    order by n.km
    limit 25
  ) c
$$;

revoke execute on function public.ai_recommend_candidates(double precision, double precision, double precision, timestamptz)
  from public, anon;
grant execute on function public.ai_recommend_candidates(double precision, double precision, double precision, timestamptz)
  to authenticated;

-- 5. Sales summary for the promotion advisor --------------------------------------
create or replace function public.owner_sales_summary(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := now() - interval '60 days';
begin
  if not public.owns_business(p_business_id) then
    raise exception using errcode = '42501', message = 'not_business_owner';
  end if;
  return jsonb_build_object(
    'orders', (select count(*) from public.orders o
               where o.business_id = p_business_id and o.created_at >= v_since),
    'cancel_rate', (select coalesce(round(avg((o.status = 'cancelled')::int)::numeric, 2), 0)
                    from public.orders o where o.business_id = p_business_id and o.created_at >= v_since),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
                'menu_item_id', m.id, 'name', m.name, 'price_cop', m.price_cop,
                'days_listed', greatest((now()::date - m.created_at::date), 0),
                'units', coalesce(s.units, 0)) order by coalesce(s.units, 0), m.id), '[]'::jsonb)
              from public.menu_items m
              left join (
                select i.menu_item_id, sum(i.quantity)::int as units
                from public.order_items i
                join public.orders o on o.id = i.order_id
                where o.business_id = p_business_id and o.created_at >= v_since and o.status <> 'cancelled'
                group by i.menu_item_id
              ) s on s.menu_item_id = m.id
              where m.business_id = p_business_id and m.is_available),
    'slots', (select coalesce(jsonb_agg(jsonb_build_object('dow', t.dow, 'slot', t.slot, 'orders', t.orders)
                order by t.dow, t.slot), '[]'::jsonb)
              from (
                select extract(dow from local)::int as dow,
                       case when extract(hour from local) between 5 and 10 then 'morning'
                            when extract(hour from local) between 11 and 14 then 'midday'
                            when extract(hour from local) between 15 and 17 then 'afternoon'
                            when extract(hour from local) between 18 and 21 then 'evening'
                            else 'night' end as slot,
                       count(*)::int as orders
                from (select o.created_at at time zone 'America/Bogota' as local
                      from public.orders o
                      where o.business_id = p_business_id and o.created_at >= v_since
                        and o.status <> 'cancelled') x
                group by 1, 2
              ) t)
  );
end;
$$;

revoke execute on function public.owner_sales_summary(uuid) from public, anon;
grant execute on function public.owner_sales_summary(uuid) to authenticated;

notify pgrst, 'reload schema';
