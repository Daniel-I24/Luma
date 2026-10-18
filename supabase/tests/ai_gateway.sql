-- -----------------------------------------------------------------------------
-- Luma IA server side: quotas, cache, candidates and the owner sales summary.
-- Roles: anon, a customer (cus), the owner of pub, another owner (eve), an
-- admin (adm) and service_role. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql

-- Small limits to reach them quickly.
update public.app_settings set int_value = 2 where key = 'ai_daily_per_user';
update public.app_settings set int_value = 1 where key = 'ai_daily_per_business';

-- Two orders at pub (open 24/7): one picked up with 3 Tinto, one cancelled.
insert into public.orders (id, user_id, business_id, business_name, business_address, total_cop, status) values
  (tests.id('o1'), tests.id('cus'), tests.id('pub'), 'Café Público', 'Calle 19', 6000, 'picked_up'),
  (tests.id('o2'), tests.id('cus'), tests.id('pub'), 'Café Público', 'Calle 19', 2000, 'cancelled');
insert into public.order_items (order_id, menu_item_id, name, unit_price_cop, list_price_cop, quantity) values
  (tests.id('o1'), tests.id('mpub'), 'Tinto', 2000, 2000, 3),
  (tests.id('o2'), tests.id('mpub'), 'Tinto', 2000, 2000, 1);

-- -- tables are closed -------------------------------------------------------------
select tests.expect_error('authenticated', tests.id('cus'), $$select * from public.ai_usage$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('adm'), $$select * from public.ai_cache$$, 'permission denied');
select tests.expect_error('anon', null, $$insert into public.ai_cache (key, value, expires_at) values ('xxxxxxxx', '{}', now())$$, 'permission denied');

-- -- quotas -------------------------------------------------------------------------
select tests.expect_error('anon', null, $$select public.consume_ai_quota()$$, 'permission denied');
select tests.expect_true('authenticated', tests.id('cus'),
  $$select public.consume_ai_quota() and public.consume_ai_quota() and not public.consume_ai_quota()$$,
  'a user gets the daily limit, then false');
select tests.expect_true('authenticated', tests.id('eve'),
  $$select public.consume_ai_quota()$$, 'other users keep their own quota');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select public.consume_ai_quota(tests.id('pub')) and not public.consume_ai_quota(tests.id('pub'))$$,
  'a business has its own daily limit');
select tests.expect_error('authenticated', tests.id('eve'),
  $$select public.consume_ai_quota(tests.id('pub'))$$, 'not_business_owner');
select tests.expect_true('postgres', null,
  $$select (select calls from public.ai_usage where scope = 'user' and subject = tests.id('cus')) = 2$$,
  'a refused call does not count');

-- -- cache: service_role only ------------------------------------------------------
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.ai_cache_put('recommend:abcdef', '{"x":1}', 600)$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.ai_cache_get('recommend:abcdef')$$, 'permission denied');
select tests.exec_as('service_role', null, $$select public.ai_cache_put('recommend:abcdef', '{"x":1}', 600)$$);
select tests.expect_true('service_role', null,
  $$select public.ai_cache_get('recommend:abcdef') = '{"x":1}'::jsonb
       and public.ai_cache_get('recommend:missing') is null$$, 'service_role reads what it cached');
select tests.exec_as('service_role', null, $$select public.ai_cache_put('recommend:shortttl', '{"x":2}', 999999)$$);
select tests.expect_true('postgres', null,
  $$select expires_at <= now() + interval '24 hours' from public.ai_cache where key = 'recommend:shortttl'$$,
  'TTL is capped at 24 hours');

-- -- candidates: public and open only ------------------------------------------------
select tests.expect_error('anon', null,
  $$select public.ai_recommend_candidates(1.21, -77.28, 5, now())$$, 'permission denied');
select tests.expect_true('authenticated', tests.id('cus'), $$
  with c as (select jsonb_array_elements(public.ai_recommend_candidates(1.21, -77.28, 5, now())) as v)
  select count(*) = 1 and bool_and(v ->> 'id' = tests.id('pub')::text)
     and bool_and(jsonb_array_length(v -> 'items') between 1 and 4)
  from c$$, 'only public, open businesses come back (v1 is a draft)');
select tests.expect_true('authenticated', tests.id('cus'),
  $$select jsonb_array_length(public.ai_recommend_candidates(4.6, -74.08, 10, now())) = 0$$,
  'nothing outside the radius');

-- -- sales summary: owner only, aggregates only ----------------------------------------
select tests.expect_error('authenticated', tests.id('eve'),
  $$select public.owner_sales_summary(tests.id('pub'))$$, 'not_business_owner');
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.owner_sales_summary(tests.id('pub'))$$, 'not_business_owner');
select tests.expect_error('authenticated', tests.id('adm'),
  $$select public.owner_sales_summary(tests.id('pub'))$$, 'not_business_owner');
select tests.expect_error('anon', null,
  $$select public.owner_sales_summary(tests.id('pub'))$$, 'permission denied');
select tests.expect_true('authenticated', tests.id('owner'), $$
  with s as (select public.owner_sales_summary(tests.id('pub')) as v)
  select (v ->> 'orders')::int = 2 and (v ->> 'cancel_rate')::numeric = 0.5
     and (v -> 'items' -> 0 ->> 'units')::int = 3
     and v::text not like '%' || tests.id('cus')::text || '%'
     and v::text not like '%' || tests.id('o1')::text || '%'
  from s$$, 'units, orders and cancel rate, without customer or order ids');

rollback;
