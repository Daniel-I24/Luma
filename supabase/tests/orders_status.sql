-- ─────────────────────────────────────────────────────────────────────────────
-- Orders: who sees what, cancelling, status transitions and the pending limit.
-- Run like orders_security.sql; rolled back at the end.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _orders_fixtures.sql

select tests.exec_as('authenticated', tests.id('ana'), $$
  select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '1')), null, 'ana-1')$$);
select tests.exec_as('authenticated', tests.id('ana'), $$
  select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m4', '3')), null, 'ana-2')$$);

-- ── a user never sees or cancels someone else's order ───────────────────────
select tests.expect_true('authenticated', tests.id('bob'),
  $$select count(*) = 0 from public.orders$$, 'bob sees no orders of ana');
select tests.expect_true('authenticated', tests.id('bob'),
  $$select count(*) = 0 from public.order_items$$, 'bob sees no order lines of ana');
select tests.expect_true('authenticated', tests.id('ana'),
  $$select count(*) = 2 from public.orders$$, 'ana sees her two orders');
select tests.expect_error('authenticated', tests.id('bob'),
  $$select public.cancel_order(tests.order_id('ana-1'))$$, 'order_not_found');

-- ── business owners do not read orders yet ──────────────────────────────────
select tests.expect_true('authenticated', tests.id('owner'),
  $$select count(*) = 0 from public.orders$$, 'owner cannot read orders (future safe view)');

-- ── cancel: only the customer, only while pending ───────────────────────────
select tests.exec_as('authenticated', tests.id('ana'), $$select public.cancel_order(tests.order_id('ana-1'))$$);
select tests.expect_true('authenticated', tests.id('ana'),
  $$select status = 'cancelled' from public.orders where id = tests.order_id('ana-1')$$, 'ana cancelled her pending order');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.cancel_order(tests.order_id('ana-1'))$$, 'invalid_transition');

select tests.exec_as('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('ana-2'), 'accepted')$$);
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.cancel_order(tests.order_id('ana-2'))$$, 'invalid_transition');

-- ── set_order_status: only the business owner, only valid transitions ───────
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.set_order_status(tests.order_id('ana-2'), 'preparing')$$, 'order_not_found');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('ana-2'), 'picked_up')$$, 'invalid_transition');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('ana-2'), 'cancelled')$$, 'invalid_transition');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('ana-2'), 'nonsense')$$, 'invalid_transition');
select tests.exec_as('authenticated', tests.id('owner'), $$
  select public.set_order_status(tests.order_id('ana-2'), 'preparing');
  select public.set_order_status(tests.order_id('ana-2'), 'ready');
  select public.set_order_status(tests.order_id('ana-2'), 'picked_up')$$);
select tests.expect_true('authenticated', tests.id('ana'),
  $$select status = 'picked_up' and updated_at >= created_at from public.orders where id = tests.order_id('ana-2')$$,
  'owner moved the order to picked_up');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('ana-2'), 'cancelled')$$, 'invalid_transition');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('ana-1'), 'accepted')$$, 'invalid_transition');

-- ── at most 5 pending orders per user ───────────────────────────────────────
select tests.exec_as('authenticated', tests.id('bob'), format($$
  select public.create_order(tests.id('b2'), jsonb_build_array(tests.line('m3', '1')), null, 'bob-%s')$$, n))
from generate_series(1, 5) as n;
select tests.expect_true('authenticated', tests.id('bob'),
  $$select count(*) = 5 from public.orders where status = 'pending'$$, 'bob has 5 pending orders');
select tests.expect_error('authenticated', tests.id('bob'),
  $$select public.create_order(tests.id('b2'), jsonb_build_array(tests.line('m3', '1')))$$, 'too_many_pending');

-- Cancelling one frees a slot.
select tests.exec_as('authenticated', tests.id('bob'), $$select public.cancel_order(tests.order_id('bob-1'))$$);
select tests.exec_as('authenticated', tests.id('bob'), $$
  select public.create_order(tests.id('b2'), jsonb_build_array(tests.line('m3', '1')), null, 'bob-6')$$);
select tests.expect_true('authenticated', tests.id('bob'),
  $$select count(*) = 5 from public.orders where status = 'pending'$$, 'a cancelled order frees a pending slot');

rollback;
