-- -----------------------------------------------------------------------------
-- Cancellation (migration 60): the rule lives in the server. Abuse: other
-- people's orders, late cancels, direct updates, repeats, invented reasons.
-- Roles: anon, customers ana and bob, owner of b1, service_role. Rolled back.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _orders_fixtures.sql

select tests.exec_as('authenticated', tests.id('ana'), $$
  select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '1')), null, 'ana-1')$$);
select tests.exec_as('authenticated', tests.id('ana'), $$
  select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m4', '3')), null, 'ana-2')$$);

create function tests.with_status(p_key text, p_status text) returns uuid language plpgsql as $$
declare v_id uuid := tests.order_id(p_key);
begin
  update public.orders set status = p_status where id = v_id;
  return v_id;
end $$;

-- -- The customer, until the kitchen starts -----------------------------------------------
select tests.exec_as('authenticated', tests.id('ana'),
  format($q$select public.cancel_order(%L)$q$, tests.order_id('ana-1')));
select tests.expect_true('postgres', null, format($q$
  select status = 'cancelled' and cancel_reason = 'customer' from public.orders where id = %L$q$, tests.order_id('ana-1')),
  'pending: cancelled, and it says who');

select tests.with_status('ana-2', 'accepted');
select tests.exec_as('authenticated', tests.id('ana'),
  format($q$select public.cancel_order(%L)$q$, tests.order_id('ana-2')));
select tests.expect_true('postgres', null, format($q$
  select status = 'cancelled' from public.orders where id = %L$q$, tests.order_id('ana-2')),
  'accepted: still cancellable, the kitchen has not started');

-- -- From preparing on, never -----------------------------------------------------------------
select tests.with_status('ana-2', 'preparing');
select tests.expect_error('authenticated', tests.id('ana'),
  format($q$select public.cancel_order(%L)$q$, tests.order_id('ana-2')), 'too_late_to_cancel');
select tests.with_status('ana-2', 'ready');
select tests.expect_error('authenticated', tests.id('ana'),
  format($q$select public.cancel_order(%L)$q$, tests.order_id('ana-2')), 'too_late_to_cancel');
select tests.with_status('ana-2', 'picked_up');
select tests.expect_error('authenticated', tests.id('ana'),
  format($q$select public.cancel_order(%L)$q$, tests.order_id('ana-2')), 'invalid_transition');
select tests.with_status('ana-2', 'cancelled');
select tests.expect_error('authenticated', tests.id('ana'),
  format($q$select public.cancel_order(%L)$q$, tests.order_id('ana-2')), 'invalid_transition');

-- -- Abuse -------------------------------------------------------------------------------------
select tests.expect_error('anon', null,
  format($q$select public.cancel_order(%L)$q$, tests.order_id('ana-1')), 'permission denied');
select tests.with_status('ana-1', 'pending');
select tests.expect_error('authenticated', tests.id('bob'),
  format($q$select public.cancel_order(%L)$q$, tests.order_id('ana-1')), 'order_not_found');
select tests.expect_error('authenticated', tests.id('owner'),
  format($q$select public.cancel_order(%L)$q$, tests.order_id('ana-1')), 'order_not_found');
select tests.expect_error('authenticated', tests.id('ana'),
  format($q$update public.orders set status = 'cancelled' where id = %L$q$, tests.order_id('ana-1')), 'permission denied');
select tests.expect_error('authenticated', tests.id('ana'),
  format($q$select public.set_order_status(%L, 'cancelled', 'other')$q$, tests.order_id('ana-1')), 'order_not_found');

-- -- The business: its reasons, and only its orders -----------------------------------------
select tests.expect_error('authenticated', tests.id('owner'),
  format($q$select public.set_order_status(%L, 'cancelled', 'customer')$q$, tests.order_id('ana-1')), 'invalid_reason');
select tests.expect_error('authenticated', tests.id('owner'),
  format($q$select public.set_order_status(%L, 'cancelled', 'payment_expired')$q$, tests.order_id('ana-1')), 'invalid_reason');
select tests.with_status('ana-1', 'preparing');
select tests.expect_error('authenticated', tests.id('owner'),
  format($q$select public.set_order_status(%L, 'cancelled')$q$, tests.order_id('ana-1')), 'reason_required');
select tests.exec_as('authenticated', tests.id('owner'),
  format($q$select public.set_order_status(%L, 'cancelled', 'out_of_stock')$q$, tests.order_id('ana-1')));
select tests.expect_true('postgres', null, format($q$
  select cancel_reason = 'out_of_stock' from public.orders where id = %L$q$, tests.order_id('ana-1')),
  'the business may cancel while preparing, with a reason');

-- -- The automatic void ----------------------------------------------------------------------
select tests.expect_error('authenticated', tests.id('ana'), $$select * from public.payments_to_void()$$, 'permission denied');
select tests.expect_error('anon', null, $$select * from public.payments_to_void()$$, 'permission denied');
select tests.expect_true('service_role', null, $$select count(*) >= 0 from public.payments_to_void()$$, 'service role reads it');

rollback;
