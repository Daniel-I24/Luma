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

-- -- deleting the account deletes its orders (user_id ON DELETE CASCADE) ------
delete from auth.users where id = tests.id('bob');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select tests.order_id('bob-order') is null$$, 'account deletion removes the customer''s orders');

rollback;
