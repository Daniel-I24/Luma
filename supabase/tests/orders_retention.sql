-- -----------------------------------------------------------------------------
-- Orders: business copies taken at purchase and what deletions do.
-- Run like orders_security.sql; rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _orders_fixtures.sql

select tests.exec_as('authenticated', tests.id('ana'), $$
  select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '1')), null, 'keep-me')$$);
select tests.exec_as('authenticated', tests.id('bob'), $$
  select public.create_order(tests.id('b2'), jsonb_build_array(tests.line('m3', '1')), null, 'bob-order')$$);

-- -- the order keeps a copy of the business name and address ---------------
select tests.expect_true('authenticated', tests.id('ana'),
  $$select business_name = 'Test Fritanga' and business_address = 'Calle 1'
    from public.orders where id = tests.order_id('keep-me')$$, 'name and address copied at purchase');

-- -- clients cannot write the copies -----------------------------------------
select tests.expect_error('authenticated', tests.id('ana'),
  $$update public.orders set business_name = 'Fake' where id = tests.order_id('keep-me')$$, 'permission denied');

-- -- renaming the business does not rewrite past orders ----------------------
update public.businesses set name = 'Renamed', address = 'Calle 99' where id = tests.id('b1');
select tests.expect_true('authenticated', tests.id('ana'),
  $$select business_name = 'Test Fritanga' and business_address = 'Calle 1'
    from public.orders where id = tests.order_id('keep-me')$$, 'copies survive a rename');

-- -- deleting the business keeps the order with business_id NULL --------------
select tests.exec_as('authenticated', tests.id('owner'), $$delete from public.businesses where id = tests.id('b1')$$);
select tests.expect_true('authenticated', tests.id('ana'),
  $$select business_id is null and business_name = 'Test Fritanga' and total_cop = 6000
    from public.orders where id = tests.order_id('keep-me')$$, 'order kept after the business is deleted');
select tests.expect_true('authenticated', tests.id('ana'),
  $$select count(*) = 1 from public.order_items where order_id = tests.order_id('keep-me')$$,
  'lines kept after the business is deleted');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('keep-me'), 'accepted')$$, 'order_not_found');
select tests.expect_true('authenticated', tests.id('bob'),
  $$select count(*) = 0 from public.orders where business_id is null$$, 'orphan orders stay private to their customer');
select tests.exec_as('authenticated', tests.id('ana'), $$select public.cancel_order(tests.order_id('keep-me'))$$);
select tests.expect_true('authenticated', tests.id('ana'),
  $$select status = 'cancelled' from public.orders where id = tests.order_id('keep-me')$$,
  'customer can still cancel a pending orphan order');

-- -- deleting the account anonymises its orders (user_id ON DELETE SET NULL) --
select tests.exec_as('authenticated', tests.id('bob'), $$
  select public.create_order(tests.id('b2'), jsonb_build_array(tests.line('m3', '1')), null, 'bob-second')$$);
-- Keep the ids: notes are cleared once the order is anonymised.
create temp table bob_orders as
  select id from public.orders where user_id = tests.id('bob');
grant select on bob_orders to authenticated;
select tests.expect_true('authenticated', tests.id('owner'),
  $$select count(*) = 2 from bob_orders$$, 'bob placed two orders');
delete from auth.users where id = tests.id('bob');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select count(*) = 2 and bool_and(customer_label is null and notes is null)
    from public.business_orders where id in (select id from bob_orders)$$,
  'the business still sees the anonymised orders, without notes or name');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select count(*) = 2 from public.business_order_items
    where order_id in (select id from bob_orders)$$, 'and their lines');
select tests.expect_true('authenticated', tests.id('ana'),
  $$select count(*) = 0 from public.orders where user_id is null$$,
  'no customer reads anonymised orders');
-- Checked as the test runner: nothing left that points to the account.
do $$
begin
  if exists (select 1 from public.orders o join bob_orders b using (id)
             where o.user_id is not null or o.notes is not null) then
    raise exception 'FAIL anonymised orders still hold user_id or notes';
  end if;
  if (select count(*) from public.orders o join bob_orders b using (id)) <> 2 then
    raise exception 'FAIL anonymised orders were deleted';
  end if;
  raise notice 'ok  [postgres] anonymised: rows kept, user_id and notes cleared';
end;
$$;

rollback;
