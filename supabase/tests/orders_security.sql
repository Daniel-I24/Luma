-- ─────────────────────────────────────────────────────────────────────────────
-- Orders: privileges and create_order validation.
-- Run as a superuser on a database with every migration applied, e.g.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/orders_security.sql
-- Everything happens in one transaction that is rolled back.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _orders_fixtures.sql

-- ── anon can do nothing ──────────────────────────────────────────────────────
select tests.expect_error('anon', null,
  $$select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '1')))$$, 'permission denied');
select tests.expect_error('anon', null, $$select public.cancel_order(tests.id('x'))$$, 'permission denied');
select tests.expect_error('anon', null, $$select public.set_order_status(tests.id('x'), 'accepted')$$, 'permission denied');
select tests.expect_error('anon', null, $$select count(*) from public.orders$$, 'permission denied');
select tests.expect_error('anon', null, $$select count(*) from public.order_items$$, 'permission denied');

-- ── clients never write the tables directly ─────────────────────────────────
select tests.expect_error('authenticated', tests.id('ana'),
  $$insert into public.orders (business_id, total_cop) values (tests.id('b1'), 1)$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('ana'),
  $$insert into public.order_items (order_id, name, unit_price_cop, quantity) values (tests.id('x'), 'x', 1, 1)$$,
  'permission denied');
select tests.expect_error('authenticated', tests.id('ana'), $$select * from public.app_settings$$, 'permission denied');
select tests.expect_error('authenticated', null,
  $$select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '1')))$$, 'not_authenticated');

-- ── the server computes the total; a client price is ignored ────────────────
select tests.exec_as('authenticated', tests.id('ana'), $$
  select public.create_order(tests.id('b1'),
    jsonb_build_array(tests.line('m1', '2', '{"price_cop": 1, "unit_price_cop": 1}'), tests.line('m4', '1')),
    null, 'price-ignored')$$);
select tests.expect_true('authenticated', tests.id('ana'),
  $$select total_cop = 14000 and status = 'pending' and payment_method = 'pay_at_pickup'
    from public.orders where id = tests.order_id('price-ignored')$$, 'total 2×6000 + 2000 from menu prices');
select tests.expect_true('authenticated', tests.id('ana'),
  $$select array_agg(unit_price_cop order by unit_price_cop) = '{2000,6000}'
    from public.order_items where order_id = tests.order_id('price-ignored')$$, 'lines copy the menu prices');

-- ── nor can the client change total or status afterwards ────────────────────
select tests.expect_error('authenticated', tests.id('ana'),
  $$update public.orders set total_cop = 1 where id = tests.order_id('price-ignored')$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('ana'),
  $$update public.orders set status = 'picked_up' where id = tests.order_id('price-ignored')$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('ana'),
  $$delete from public.orders where id = tests.order_id('price-ignored')$$, 'permission denied');

-- ── item and business checks ─────────────────────────────────────────────────
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m3', '1')))$$, 'item_unavailable');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m2', '1')))$$, 'item_unavailable');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b3'), jsonb_build_array(tests.line('m5', '1')))$$, 'business_unavailable');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '1'), tests.line('m1', '2')))$$,
  'duplicate_items');

-- ── line shape: 1 to 20 lines, quantities 1 to 20, whole numbers ────────────
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b1'), '[]')$$, 'invalid_items');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '0')))$$, 'invalid_items');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '21')))$$, 'invalid_items');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '1.5')))$$, 'invalid_items');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '"2"')))$$, 'invalid_items');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b1'), '[{"menu_item_id": "not-a-uuid", "quantity": 1}]')$$, 'invalid_items');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b1'),
    (select jsonb_agg(tests.line('m1', '1')) from generate_series(1, 21)))$$, 'invalid_items');

-- ── pick-up window: null (asap) or 10 minutes to 7 days ahead ───────────────
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '1')), now() + interval '5 minutes')$$,
  'invalid_pickup_time');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '1')), now() + interval '8 days')$$,
  'invalid_pickup_time');
select tests.exec_as('authenticated', tests.id('ana'), $$
  select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '1')),
    now() + interval '1 hour', 'scheduled')$$);
select tests.expect_true('authenticated', tests.id('ana'),
  $$select pickup_at is not null from public.orders where id = tests.order_id('scheduled')$$, 'scheduled pick-up accepted');

-- ── notes and total cap ──────────────────────────────────────────────────────
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '1')), null, repeat('x', 201))$$,
  'invalid_notes');
update public.app_settings set int_value = 10000 where key = 'order_max_total_cop';
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '2')))$$, 'total_too_high');

rollback;
