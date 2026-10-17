-- -----------------------------------------------------------------------------
-- Notifications: created by the order triggers; each user reads, marks and
-- deletes only their own; clients never insert. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _orders_fixtures.sql

select tests.exec_as('authenticated', tests.id('ana'), $$
  select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '1')), null, 'n-ana')$$);
select tests.exec_as('authenticated', tests.id('bob'), $$
  select public.create_order(tests.id('b2'), jsonb_build_array(tests.line('m3', '1')), null, 'n-bob')$$);

-- -- triggers ------------------------------------------------------------------
select tests.expect_true('authenticated', tests.id('owner'),
  $$select count(*) = 2 and bool_and(type = 'order_new' and status = 'pending') from public.notifications$$,
  'the owner is told about each new order');
select tests.exec_as('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('n-ana'), 'accepted')$$);
select tests.expect_true('authenticated', tests.id('ana'),
  $$select count(*) = 1 and bool_and(type = 'order_status' and status = 'accepted'
       and order_id = tests.order_id('n-ana')) from public.notifications$$,
  'the customer is told when the owner changes the status');
select tests.exec_as('authenticated', tests.id('bob'), $$select public.cancel_order(tests.order_id('n-bob'))$$);
select tests.expect_true('authenticated', tests.id('bob'),
  $$select count(*) = 0 from public.notifications$$, 'no notification for a change the customer made');

-- -- nobody reads, marks or deletes someone else's -------------------------------
select tests.expect_true('authenticated', tests.id('bob'),
  $$select count(*) = 0 from public.notifications where user_id <> tests.id('bob')$$,
  'bob reads none of the others');
select tests.exec_as('authenticated', tests.id('bob'), $$update public.notifications set read_at = now()$$);
select tests.exec_as('authenticated', tests.id('bob'), $$delete from public.notifications$$);
select tests.expect_true('authenticated', tests.id('ana'),
  $$select count(*) = 1 and bool_and(read_at is null) from public.notifications$$,
  'bob could not mark or delete ana''s notification');
select tests.expect_error('anon', null, $$select count(*) from public.notifications$$, 'permission denied');

-- -- own: only read_at may change ----------------------------------------------
select tests.exec_as('authenticated', tests.id('ana'), $$update public.notifications set read_at = now()$$);
select tests.expect_true('authenticated', tests.id('ana'),
  $$select bool_and(read_at is not null) from public.notifications$$, 'ana marks hers as read');
select tests.expect_error('authenticated', tests.id('ana'),
  $$update public.notifications set user_id = tests.id('bob')$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('ana'),
  $$update public.notifications set status = 'ready'$$, 'permission denied');
select tests.exec_as('authenticated', tests.id('ana'), $$delete from public.notifications$$);
select tests.expect_true('authenticated', tests.id('ana'),
  $$select count(*) = 0 from public.notifications$$, 'ana deletes hers');

-- -- clients never insert --------------------------------------------------------
select tests.expect_error('authenticated', tests.id('ana'),
  $$insert into public.notifications (user_id, type) values (tests.id('ana'), 'order_new')$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('ana'),
  $$insert into public.notifications (user_id, type) values (tests.id('bob'), 'order_status')$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.notify_order_created()$$, 'permission denied');
select tests.expect_true('anon', null,
  $$select not has_function_privilege('authenticated', 'public.notify_order_status_changed()', 'execute')
       and not has_function_privilege('anon', 'public.notify_order_created()', 'execute')$$,
  'no client role can call the trigger functions');

rollback;
