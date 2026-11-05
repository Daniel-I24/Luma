-- -----------------------------------------------------------------------------
-- Round 10 (20261107000000_round10.sql): the optional sector and reference of
-- a business, order_pickup_point (only the customer of the order, only while
-- it is on its way, even when the business is no longer public) and order
-- events split by audience (an owner never receives a customer id).
-- Users: cus (the customer), cus2 (another customer), owner (the business),
-- eve (another owner). Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql
insert into auth.users (id, email) values (tests.id('cus2'), 'cus2@test.local');
select tests.complete_profile('cus2');
delete from public.order_events;

-- 1. Sector and reference ---------------------------------------------------------
select tests.exec_as('authenticated', tests.id('owner'), $$
  update public.businesses set neighborhood = 'Jamondino', address_reference = 'Al frente del parque'
  where id = tests.id('pub')$$);
select tests.expect_true('anon', null, $$
  select neighborhood = 'Jamondino' and address_reference = 'Al frente del parque' from public.businesses where id = tests.id('pub')$$,
  'the owner saves the sector and the reference');
select tests.expect_error('authenticated', tests.id('owner'), $$
  update public.businesses set address_reference = repeat('a', 101) where id = tests.id('pub')$$, 'businesses_address_reference_rule');
select tests.expect_error('authenticated', tests.id('owner'), $$
  update public.businesses set neighborhood = repeat('a', 61) where id = tests.id('pub')$$, 'businesses_neighborhood_rule');

-- 2. The pick-up point -------------------------------------------------------------
select tests.exec_as('authenticated', tests.id('cus'),
  $$select public.create_order(tests.id('pub'), jsonb_build_array(tests.line_of('mpub', 1)))$$);
create function tests.the_order() returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.orders where business_id = tests.id('pub') order by created_at desc limit 1 $$;
grant execute on function tests.the_order() to authenticated;
create function tests.pickup_rows() returns bigint language sql stable as $$
  select count(*) from public.order_pickup_point(tests.the_order()) $$;
grant execute on function tests.pickup_rows() to authenticated;

select tests.expect_true('authenticated', tests.id('cus'), $$select tests.pickup_rows() = 0$$, 'pending: no pick-up point yet');
select tests.exec_as('authenticated', tests.id('owner'), format('select public.set_order_status(%L, %L, null)', tests.the_order(), 'accepted'));
select tests.expect_true('authenticated', tests.id('cus'), $$
  select name = 'Café Público' and address = 'Calle 19 # 20-10' and latitude = 1.21 and longitude = -77.28
  from public.order_pickup_point(tests.the_order())$$, 'accepted: the customer gets name, address and coordinates');
select tests.expect_true('authenticated', tests.id('cus2'), $$select tests.pickup_rows() = 0$$, 'another customer gets nothing');
select tests.expect_true('authenticated', tests.id('eve'), $$select tests.pickup_rows() = 0$$, 'another owner gets nothing');
select tests.expect_true('authenticated', tests.id('owner'), $$select tests.pickup_rows() = 0$$, 'not even the business owner (not their order)');
select tests.expect_error('anon', null, $$select * from public.order_pickup_point(gen_random_uuid())$$, 'permission denied');

select tests.exec_as('authenticated', tests.id('owner'), $$update public.businesses set is_active = false where id = tests.id('pub')$$);
select tests.expect_true('authenticated', tests.id('cus'), $$
  select count(*) = 0 from public.businesses where id = tests.id('pub')$$, 'the paused business is hidden from the customer');
select tests.expect_true('authenticated', tests.id('cus'), $$select tests.pickup_rows() = 1$$, 'but the customer can still reach it');
select tests.exec_as('authenticated', tests.id('owner'), format('select public.set_order_status(%L, %L, null)', tests.the_order(), 'preparing'));
select tests.exec_as('authenticated', tests.id('owner'), format('select public.set_order_status(%L, %L, null)', tests.the_order(), 'ready'));
select tests.expect_true('authenticated', tests.id('cus'), $$select tests.pickup_rows() = 1$$, 'ready: still there');
select tests.exec_as('authenticated', tests.id('owner'), format('select public.set_order_status(%L, %L, null)', tests.the_order(), 'picked_up'));
select tests.expect_true('authenticated', tests.id('cus'), $$select tests.pickup_rows() = 0$$, 'picked up: gone');
select tests.expect_true('postgres', null, $$
  select p.prosecdef and p.proconfig = array['search_path=""'] from pg_proc p where p.proname = 'order_pickup_point'$$,
  'SECURITY DEFINER with an empty search_path');

-- 3. Order events by audience -------------------------------------------------------
select tests.expect_true('authenticated', tests.id('owner'), $$
  select count(*) > 0 and bool_and(user_id is null) from public.order_events where order_id = tests.the_order()$$,
  'the owner receives order events without the customer id');
select tests.expect_true('authenticated', tests.id('cus'), $$
  select count(*) > 0 and bool_and(business_id is null and user_id = tests.id('cus')) from public.order_events where order_id = tests.the_order()$$,
  'the customer receives their own rows');
select tests.expect_true('authenticated', tests.id('cus2'), $$select count(*) = 0 from public.order_events$$, 'another customer receives nothing');
select tests.expect_true('authenticated', tests.id('eve'), $$select count(*) = 0 from public.order_events$$, 'another owner receives nothing');
select tests.expect_error('postgres', null, $$
  insert into public.order_events (order_id, user_id, business_id) values (gen_random_uuid(), tests.id('cus'), tests.id('pub'))$$,
  'order_events_one_audience');

-- 4. RLS: auth.uid() is evaluated once per query everywhere --------------------------
select tests.expect_true('postgres', null, $$
  select count(*) = 0 from pg_policies
  where (coalesce(qual, '') || coalesce(with_check, '')) ~ 'auth\.uid\(\)'
    and (coalesce(qual, '') || coalesce(with_check, '')) !~* '\(\s*select\s+auth\.uid\(\)'$$,
  'no policy calls auth.uid() per row');
select tests.expect_true('authenticated', tests.id('owner'), $$
  select count(*) = 2 from public.businesses where owner_id = tests.id('owner')$$, 'the owner still reads both businesses');
select tests.expect_error('authenticated', tests.id('eve'), $$
  insert into public.menu_items (business_id, name, price_cop) values (tests.id('pub'), 'Intruso', 1000)$$, 'row-level security');

rollback;
