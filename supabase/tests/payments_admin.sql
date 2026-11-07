-- -----------------------------------------------------------------------------
-- Payments: immutable attempts, append-only events, expiry of unpaid orders,
-- paid orders cancelled -> refund_required, admin payment tools (aal1 and
-- aal2), review invitations. Roles: customers ana and bob, owner of b1,
-- admin (adm), service_role, postgres. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _orders_fixtures.sql
insert into auth.users (id, email) values (tests.id('adm'), 'adm@test.local');
insert into public.admins (user_id) values (tests.id('adm'));
update public.app_settings set int_value = 1 where key = 'payments_enabled';

-- An online order of p_user with one prepared attempt; returns its reference.
create function tests.online_order(p_user text, p_note text) returns text language plpgsql as $$
declare v_ref text;
begin
  perform tests.become('authenticated', tests.id(p_user));
  perform public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '1')), null, p_note, 'online');
  select reference into v_ref from public.prepare_payment(tests.order_id(p_note), 'test');
  perform tests.restore();
  return v_ref;
end $$;
create table tests.refs (note text primary key, reference text);
insert into tests.refs values ('paid', tests.online_order('bob', 'paid')), ('late', tests.online_order('ana', 'late')),
                              ('quit', tests.online_order('ana', 'quit'));
grant select on tests.refs to service_role;
create function tests.approve(p_note text, p_tx text) returns text language sql as $$
  select public.apply_payment_event((select reference from tests.refs where note = p_note), p_tx, 'APPROVED', 600000,
                                    'COP', 'test', 'NEQUI', 'webhook') $$;
grant execute on function tests.approve(text, text) to service_role;
select tests.expect_true('service_role', null, $$select tests.approve('paid', 'tx-paid') = 'applied'$$, 'bob pays');
-- Latest attempt of an order, by its note (the test runner reads the closed table).
create function tests.payment_of(p_note text) returns uuid language sql stable security definer set search_path = ''
as $$ select p.id from public.payments p where p.order_id = tests.order_id(p_note) order by p.attempt desc limit 1 $$;
grant execute on function tests.payment_of(text) to authenticated;

-- -- immutability -----------------------------------------------------------------------------
select tests.expect_error('postgres', null,
  $$update public.payments set amount_in_cents = 1 where reference = (select reference from tests.refs where note = 'paid')$$,
  'payment_immutable');
select tests.expect_error('postgres', null,
  $$update public.payments set approved_transaction_id = 'other' where approved_transaction_id = 'tx-paid'$$,
  'payment_immutable');
select tests.expect_error('postgres', null,
  $$update public.payments set status = 'pending' where approved_transaction_id = 'tx-paid'$$, 'invalid_payment_transition');
select tests.expect_error('postgres', null, $$delete from public.payments$$, 'payment_immutable');
select tests.expect_error('service_role', null, $$select * from public.payment_events$$, 'permission denied');
select tests.expect_error('service_role', null, $$delete from public.payment_events$$, 'permission denied');
select tests.expect_error('postgres', null, $$update public.payment_events set outcome = 'ignored'$$, 'payment_events_append_only');
select tests.expect_error('postgres', null, $$delete from public.payment_events$$, 'payment_events_append_only');
select tests.expect_error('postgres', null, $$truncate public.payment_events$$, 'payment_events_append_only');
select tests.expect_error('authenticated', tests.id('bob'),
  $$update public.orders set payment_status = 'approved' where notes = 'quit'$$, 'permission denied');

-- -- unpaid orders: cancel and expiry -------------------------------------------------------------
select tests.exec_as('authenticated', tests.id('ana'), $$select public.cancel_order(tests.order_id('quit'))$$);
select tests.expect_true('postgres', null, $$
  select not exists (select 1 from public.notifications where order_id = tests.order_id('quit') and user_id = tests.id('owner'))$$,
  'the owner never hears of an unpaid order the customer cancelled');
update public.orders set created_at = now() - interval '20 minutes' where notes = 'late';
select tests.expect_true('service_role', null, $$select public.expire_stale_orders() = 1$$, 'unpaid after 15 minutes: expired');
select tests.expect_true('postgres', null, $$select status = 'cancelled' from public.orders where notes = 'late'$$,
  'the expired order is cancelled');
select tests.expect_true('service_role', null, $$select tests.approve('late', 'tx-late') = 'applied'$$,
  'a payment that arrives after expiry is still recorded');
select tests.expect_true('postgres', null, $$
  select o.payment_status = 'refund_required' and o.status = 'cancelled'
     and exists (select 1 from public.notifications n where n.order_id = o.id and n.user_id = tests.id('adm') and n.type = 'payment')
     and exists (select 1 from public.notifications n where n.order_id = o.id and n.user_id = tests.id('ana') and n.status = 'refund_required')
  from public.orders o where o.notes = 'late'$$,
  'and becomes refund_required; customer and admin are told');

-- -- a paid order cancelled by the owner -------------------------------------------------------------
select tests.exec_as('authenticated', tests.id('owner'), $$select public.set_order_status(tests.order_id('paid'), 'accepted')$$);
select tests.exec_as('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('paid'), 'cancelled', 'out_of_stock')$$);
select tests.expect_true('postgres', null,
  $$select payment_status = 'refund_required' from public.orders where notes = 'paid'$$, 'cancelled after paying: refund_required');
select tests.expect_true('service_role', null, $$select count(*) >= 1 from public.payments_to_void()$$, 'its card payment is on the list to void');
select tests.expect_true('postgres', null, $$select private.reconcile_work_pending()$$, 'and that wakes the reconcile job (migration 64)');

-- -- admin tools ----------------------------------------------------------------------------------
select tests.use_aal('aal1');
select tests.expect_error('authenticated', tests.id('adm'), $$select * from public.admin_payment_issues()$$, 'not_admin');
select tests.use_aal('aal2');
select tests.expect_error('authenticated', tests.id('owner'), $$select * from public.admin_payment_issues()$$, 'not_admin');
select tests.expect_true('authenticated', tests.id('adm'), $$
  select count(*) = 2 and bool_and(issue = 'refund_required') from public.admin_payment_issues()$$,
  'admins see the pending refunds (ids and amounts only)');
select tests.expect_true('authenticated', tests.id('adm'), $$
  select transaction_id = 'tx-paid' and environment = 'test' and not card
  from public.admin_request_void(tests.payment_of('paid'))$$,
  'a Nequi payment cannot be voided by API: manual refund');
select tests.expect_error('authenticated', tests.id('adm'), $$
  select * from public.admin_request_void(tests.payment_of('quit'))$$, 'payment_not_voidable');
select tests.exec_as('authenticated', tests.id('adm'),
  $$select public.admin_mark_refund_done(tests.payment_of('paid'))$$);
select tests.expect_true('postgres', null,
  $$select payment_status = 'refunded' from public.orders where notes = 'paid'$$, 'the admin marks the refund as done');
select tests.expect_error('authenticated', tests.id('adm'),
  $$select public.admin_mark_refund_done(tests.payment_of('paid'))$$,
  'payment_not_refundable');
select tests.expect_true('authenticated', tests.id('adm'), $$
  select array_agg(action order by id) = array['void_payment', 'mark_refund_done'] from public.admin_recent_audit(10)$$,
  'both actions are logged');

-- -- review invitation ----------------------------------------------------------------------------
select tests.exec_as('authenticated', tests.id('bob'), $$select public.create_order(tests.id('b1'),
  jsonb_build_array(tests.line('m4', '1')), null, 'eat')$$);
select tests.exec_as('authenticated', tests.id('owner'), $$
  select public.set_order_status(tests.order_id('eat'), s) from unnest(array['accepted', 'preparing', 'ready', 'picked_up']) s$$);
select tests.expect_true('postgres', null, $$
  select count(*) = 1 from public.notifications where order_id = tests.order_id('eat') and type = 'review_invite'
    and user_id = tests.id('bob') and business_id = tests.id('b1')$$,
  'one review invitation per picked-up order');

rollback;
