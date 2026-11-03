-- -----------------------------------------------------------------------------
-- Trust tiers: cancel reasons, no-show rules, strikes, tiers, my_trust_status,
-- admin_strikes and admin_clear_strikes. Roles: owner of b1, customers ana
-- and bob, admin (adm) with aal1 and aal2, anon. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _orders_fixtures.sql
insert into auth.users (id, email) values (tests.id('adm'), 'adm@test.local');
insert into public.admins (user_id) values (tests.id('adm'));

-- Orders of ana at b1 in a given status (ready_at as given).
create function tests.make_order(p_note text, p_status text, p_ready_ago interval default null,
                                 p_user text default 'ana')
returns uuid language sql
as $$
  insert into public.orders (user_id, business_id, business_name, business_address, total_cop, status, notes, ready_at)
  values (tests.id(p_user), tests.id('b1'), 'Test Fritanga', 'Calle 1', 6000, p_status, p_note, now() - p_ready_ago)
  returning id
$$;

-- -- reasons -------------------------------------------------------------------------
select tests.make_order('acc', 'accepted');
select tests.make_order('pen', 'pending');
select tests.make_order('rdy5', 'ready', interval '5 minutes');
select tests.make_order('rdy20', 'ready', interval '20 minutes');
select tests.exec_as('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('pen'), 'accepted')$$);
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('acc'), 'cancelled')$$, 'reason_required');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('acc'), 'cancelled', 'bored')$$, 'invalid_reason');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('acc'), 'preparing', 'other')$$, 'invalid_reason');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('acc'), 'cancelled', 'no_show')$$, 'no_show_too_early');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('rdy5'), 'cancelled', 'no_show')$$, 'no_show_too_early');
select tests.exec_as('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('acc'), 'cancelled', 'out_of_stock')$$);
select tests.exec_as('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('rdy20'), 'cancelled', 'no_show')$$);
select tests.expect_true('postgres', null, $$
  select cancel_reason = 'no_show' and cancelled_at is not null from public.orders where id = tests.order_id('rdy20')$$,
  'a no-show 15 minutes after ready is recorded with its time');
select tests.expect_error('authenticated', tests.id('bob'),
  $$select public.set_order_status(tests.order_id('rdy5'), 'cancelled', 'no_show')$$, 'order_not_found');
update public.orders set status = 'preparing' where id = tests.order_id('pen');
update public.orders set status = 'ready' where id = tests.order_id('pen');
select tests.expect_true('postgres', null,
  $$select ready_at > now() - interval '1 minute' from public.orders where id = tests.order_id('pen')$$,
  'ready_at is set by the server');

-- -- tiers ---------------------------------------------------------------------------------
select tests.expect_true('authenticated', tests.id('ana'),
  $$select tier = 'new' and strikes = 1 and restricted_until is null from public.my_trust_status()$$,
  'one strike: still new, no restriction');
select tests.expect_true('authenticated', tests.id('bob'),
  $$select tier = 'new' and strikes = 0 and picked_up = 0 and picked_up_needed = 2 from public.my_trust_status()$$,
  'a new customer needs two pick-ups');
select tests.make_order('p1', 'picked_up', null, 'bob');
select tests.make_order('p2', 'picked_up', null, 'bob');
select tests.expect_true('authenticated', tests.id('bob'),
  $$select tier = 'trusted' and picked_up_needed = 0 from public.my_trust_status()$$, 'two pick-ups, no strikes: trusted');

insert into public.orders (user_id, business_id, business_name, business_address, total_cop, status, cancel_reason, cancelled_at)
values (tests.id('ana'), tests.id('b1'), 'T', 'C', 1, 'cancelled', 'no_show', now() - interval '10 days'),
       (tests.id('ana'), tests.id('b1'), 'T', 'C', 1, 'cancelled', 'no_show', now() - interval '20 days'),
       (tests.id('ana'), tests.id('b1'), 'T', 'C', 1, 'cancelled', 'no_show', now() - interval '40 days');
select tests.expect_true('authenticated', tests.id('ana'), $$
  select tier = 'restricted' and strikes = 3
     and restricted_until between now() + interval '9 days 23 hours' and now() + interval '10 days 1 hour'
  from public.my_trust_status()$$,
  'three no-shows in 30 days: restricted until the third most recent one ages out (older ones do not count)');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.customer_trust_tier(tests.id('bob'))$$, 'permission denied');
select tests.expect_error('anon', null, $$select * from public.my_trust_status()$$, 'permission denied');

-- -- admin -----------------------------------------------------------------------------------
select tests.use_aal('aal1');
select tests.expect_error('authenticated', tests.id('adm'),
  $$select public.admin_clear_strikes(tests.id('ana'))$$, 'not_admin');
select tests.expect_error('authenticated', tests.id('adm'), $$select * from public.admin_strikes()$$, 'not_admin');
select tests.use_aal('aal2');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.admin_clear_strikes(tests.id('ana'))$$, 'not_admin');
select tests.expect_true('authenticated', tests.id('adm'), $$
  select count(*) = 1 and bool_and(user_id = tests.id('ana') and strikes = 3 and tier = 'restricted')
  from public.admin_strikes()$$, 'admins list customers with strikes, ids only');
select tests.exec_as('authenticated', tests.id('adm'), $$select public.admin_clear_strikes(tests.id('ana'))$$);
select tests.expect_true('authenticated', tests.id('ana'),
  $$select tier = 'new' and strikes = 0 from public.my_trust_status()$$, 'cleared strikes stop counting');
select tests.expect_true('authenticated', tests.id('adm'), $$
  select exists (select 1 from public.admin_recent_audit(5) where action = 'clear_strikes' and target_id = tests.id('ana'))$$,
  'clearing strikes is logged');
select tests.expect_error('authenticated', tests.id('adm'),
  $$select public.admin_clear_strikes(tests.id('nobody'))$$, 'user_not_found');

rollback;
