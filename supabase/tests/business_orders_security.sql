-- -----------------------------------------------------------------------------
-- Business orders: what owners see of the orders placed at their businesses.
-- Run like orders_security.sql; rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _orders_fixtures.sql

-- Eve owns another business with its own menu.
insert into auth.users (id, email) values (tests.id('eve'), 'eve@test.local');
insert into public.businesses (id, owner_id, name, category, latitude, longitude, address, is_active) values
  (tests.id('eve-biz'), tests.id('eve'), 'Eve Bar', 'Bar', 1.21, -77.28, 'Calle 5 # 1-1', true);
insert into public.business_hours (business_id, day_of_week, opens_at, closes_at)
select tests.id('eve-biz'), d, '00:00', '23:59:59.999999' from generate_series(0, 6) d;
insert into public.menu_items (id, business_id, name, price_cop) values
  (tests.id('m9'), tests.id('eve-biz'), 'Cerveza', 7000);
-- Ana has a public display name; Bob does not.
insert into public.profiles (id, email, display_name) values
  (tests.id('ana'), 'ana@test.local', 'Ana P.'),
  (tests.id('bob'), 'bob@test.local', null)
on conflict (id) do update set display_name = excluded.display_name;

select tests.exec_as('authenticated', tests.id('ana'), $$
  select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '2')), null, 'ana-at-owner')$$);
select tests.exec_as('authenticated', tests.id('bob'), $$
  select public.create_order(tests.id('b2'), jsonb_build_array(tests.line('m3', '1')), null, 'bob-at-owner')$$);
select tests.exec_as('authenticated', tests.id('ana'), $$
  select public.create_order(tests.id('eve-biz'), jsonb_build_array(tests.line('m9', '1')), null, 'ana-at-eve')$$);

-- -- each owner sees only the orders of their businesses -----------------------
select tests.expect_true('authenticated', tests.id('owner'),
  $$select count(*) = 2 and bool_and(business_id in (tests.id('b1'), tests.id('b2'))) from public.business_orders$$,
  'owner sees the 2 orders of b1 and b2');
select tests.expect_true('authenticated', tests.id('eve'),
  $$select count(*) = 1 and bool_and(business_id = tests.id('eve-biz')) from public.business_orders$$,
  'eve sees only the order of her business');
select tests.expect_true('authenticated', tests.id('eve'),
  $$select count(*) = 1 from public.business_order_items$$, 'eve sees only the lines of her orders');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select count(*) = 0 from public.business_orders where business_id = tests.id('eve-biz')$$,
  'filtering by another business id returns nothing');

-- -- customers and anon see nothing --------------------------------------------
select tests.expect_true('authenticated', tests.id('ana'),
  $$select count(*) = 0 from public.business_orders$$, 'a customer sees no business orders');
select tests.expect_true('authenticated', tests.id('ana'),
  $$select count(*) = 0 from public.business_order_items$$, 'a customer sees no business order lines');
select tests.expect_error('anon', null, $$select count(*) from public.business_orders$$, 'permission denied');
select tests.expect_error('anon', null, $$select count(*) from public.business_order_items$$, 'permission denied');

-- -- no identity: customer_label only --------------------------------------------
select tests.expect_true('authenticated', tests.id('owner'),
  $$select count(*) = 0 from information_schema.columns
    where table_schema = 'public' and table_name in ('business_orders', 'business_order_items')
      and column_name in ('user_id', 'email', 'owner_id')$$, 'the views have no user_id, email or owner_id');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select customer_label = 'Ana P.' from public.business_orders where notes = 'ana-at-owner'$$,
  'customer_label is the public display name');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select customer_label is null from public.business_orders where notes = 'bob-at-owner'$$,
  'no display name: NULL label (never the email)');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select not exists (select 1 from public.business_orders o where o::text like '%@test.local%')$$,
  'no email anywhere in the rows');

-- -- read only (not updatable views, no write grants); status only through ---
-- -- set_order_status -----------------------------------------------------------
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.business_orders set status = 'picked_up'$$, 'view "business_orders"');
select tests.expect_error('authenticated', tests.id('owner'),
  $$delete from public.business_order_items$$, 'view "business_order_items"');
select tests.exec_as('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('ana-at-owner'), 'accepted')$$);
select tests.expect_true('authenticated', tests.id('owner'),
  $$select status = 'accepted' from public.business_orders where notes = 'ana-at-owner'$$,
  'owner accepts through set_order_status');
select tests.expect_error('authenticated', tests.id('eve'),
  $$select public.set_order_status(tests.order_id('bob-at-owner'), 'accepted')$$, 'order_not_found');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('ana-at-owner'), 'picked_up')$$, 'invalid_transition');

rollback;
