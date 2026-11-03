-- -----------------------------------------------------------------------------
-- Round 4 payments (20261101000000_round4_hardening.sql): attempt_in_progress,
-- two approved attempts of one order (duplicate_charge, never paid twice),
-- refund notifications, admin_request_void and admin_mark_refund_done rules,
-- pending attempts without a redirect id in payments_to_reconcile, payments
-- closed to service_role, business_order_items without unpaid orders.
-- The harness runs one session, so the lock order (order, then payment) is
-- checked by the code path, not by two concurrent sessions.
-- Roles: customers ana and bob, owner of b1, admin (adm), service_role.
-- Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _orders_fixtures.sql
insert into auth.users (id, email) values (tests.id('adm'), 'adm@test.local');
insert into public.admins (user_id) values (tests.id('adm'));
update public.app_settings set int_value = 1 where key = 'payments_enabled';
select tests.use_aal('aal2');
-- Trust tier limits have their own suite (create_order_final.sql).
update public.app_settings set int_value = 100 where key in ('trust_new_max_pending_pickup', 'trust_new_max_daily');

create function tests.order_of(p_user text, p_note text) returns void language plpgsql as $$
begin
  perform tests.become('authenticated', tests.id(p_user));
  perform public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '1')), null, p_note, 'online');
  perform tests.restore();
end $$;
create function tests.prepare(p_user text, p_note text) returns text language plpgsql as $$
declare v_ref text;
begin
  perform tests.become('authenticated', tests.id(p_user));
  select reference into v_ref from public.prepare_payment(tests.order_id(p_note), 'test');
  perform tests.restore();
  return v_ref;
end $$;
-- Moves every attempt of an order p_minutes into the past (created_at is otherwise immutable).
create function tests.age(p_note text, p_minutes int) returns void language plpgsql as $$
begin
  alter table public.payments disable trigger payments_guard;
  update public.payments set created_at = created_at - make_interval(mins => p_minutes)
  where order_id = tests.order_id(p_note);
  alter table public.payments enable trigger payments_guard;
end $$;
create function tests.ref(p_note text, p_attempt int) returns text language sql stable security definer set search_path = ''
as $$ select reference from public.payments where order_id = tests.order_id(p_note) and attempt = p_attempt $$;
create function tests.pay(p_note text, p_attempt int) returns uuid language sql stable security definer set search_path = ''
as $$ select id from public.payments where order_id = tests.order_id(p_note) and attempt = p_attempt $$;
create function tests.event(p_note text, p_attempt int, p_tx text, p_status text) returns text language sql
as $$ select public.apply_payment_event(tests.ref(p_note, p_attempt), p_tx, p_status, 600000, 'COP', 'test', 'CARD', 'webhook') $$;
-- Seconds left in the attempt_in_progress hint, as the app reads it.
create function tests.retry_hint(p_note text) returns int language plpgsql as $$
declare v_hint text;
begin
  perform tests.become('authenticated', tests.id('bob'));
  perform public.prepare_payment(tests.order_id(p_note), 'test');
  perform tests.restore();
  return null;
exception when others then
  get stacked diagnostics v_hint = pg_exception_hint;
  perform tests.restore();
  return v_hint::int;
end $$;
grant execute on all functions in schema tests to authenticated, service_role;

-- -- one attempt at a time ------------------------------------------------------------------------
select tests.order_of('bob', 'dup');
select tests.prepare('bob', 'dup');
select tests.expect_error('authenticated', tests.id('bob'),
  $$select * from public.prepare_payment(tests.order_id('dup'), 'test')$$, 'attempt_in_progress');
select tests.expect_true('postgres', null, $$select tests.retry_hint('dup') between 170 and 180$$,
  'the error says how many seconds are left');
select tests.expect_true('authenticated', tests.id('owner'), $$
  select count(*) = 0 from public.business_order_items where order_id = tests.order_id('dup')$$,
  'the business sees no items of an order awaiting payment');
select tests.age('dup', 4);
select tests.expect_true('postgres', null, $$select tests.prepare('bob', 'dup') is not null$$,
  'after 3 minutes a new attempt is allowed');

-- -- the race: both attempts are approved -----------------------------------------------------------
select tests.expect_true('service_role', null, $$select tests.event('dup', 1, 'tx-d1', 'APPROVED') = 'applied'$$,
  'the first approval pays the order');
select tests.expect_true('service_role', null, $$select tests.event('dup', 2, 'tx-d2', 'APPROVED') = 'applied'$$,
  'the second approval is recorded');
select tests.expect_true('postgres', null, $$
  select o.status = 'pending' and o.payment_status = 'approved'
     and (select count(*) from public.payments p where p.order_id = o.id and p.status = 'approved') = 1
     and (select status from public.payments where id = tests.pay('dup', 2)) = 'refund_required'
     and (select count(*) from public.notifications n where n.order_id = o.id and n.type = 'order_new') = 1
  from public.orders o where o.notes = 'dup'$$,
  'the order is paid once: the second payment is refund_required and the owner is told once');
select tests.expect_true('postgres', null, $$
  select exists (select 1 from public.notifications where order_id = tests.order_id('dup') and user_id = tests.id('bob')
                   and status = 'duplicate_charge')
     and exists (select 1 from public.notifications where order_id = tests.order_id('dup') and user_id = tests.id('adm')
                   and status = 'refund_pending_admin')$$,
  'the customer hears of the duplicate charge and the admins of a pending refund');
select tests.expect_error('authenticated', tests.id('bob'),
  $$select * from public.prepare_payment(tests.order_id('dup'), 'test')$$, 'already_paid');
select tests.expect_true('service_role', null, $$select tests.event('dup', 2, 'tx-d2', 'APPROVED') = 'duplicate'$$,
  'the same event again changes nothing');

-- -- refunds ----------------------------------------------------------------------------------------
select tests.expect_error('authenticated', tests.id('adm'),
  $$select * from public.admin_request_void(tests.pay('dup', 1))$$, 'payment_not_voidable');
select tests.expect_true('authenticated', tests.id('adm'), $$
  select transaction_id = 'tx-d2' and card from public.admin_request_void(tests.pay('dup', 2))$$,
  'only the duplicate (refund_required) can be voided');
select tests.expect_true('service_role', null, $$
  select public.apply_payment_event(tests.ref('dup', 2), 'tx-d2', 'VOIDED', 600000, 'COP', 'test', 'CARD', 'void') = 'applied'$$,
  'the void is applied');
select tests.expect_true('postgres', null, $$
  select payment_status = 'approved' and status = 'pending' from public.orders where notes = 'dup'$$,
  'voiding the duplicate leaves the order paid');

select tests.order_of('bob', 'dup2');
select tests.prepare('bob', 'dup2');
select tests.age('dup2', 4);
select tests.prepare('bob', 'dup2');
select tests.exec_as('service_role', null, $$select tests.event('dup2', 2, 'tx-e2', 'APPROVED')$$);
select tests.exec_as('service_role', null, $$select tests.event('dup2', 1, 'tx-e1', 'APPROVED')$$);
select tests.exec_as('authenticated', tests.id('adm'), $$select public.admin_mark_refund_done(tests.pay('dup2', 1))$$);
select tests.expect_true('postgres', null, $$
  select o.payment_status = 'approved' and (select status from public.payments where id = tests.pay('dup2', 1)) = 'refunded'
  from public.orders o where o.notes = 'dup2'$$,
  'whichever attempt arrives second is the duplicate; refunding it keeps the order paid');

select tests.exec_as('authenticated', tests.id('owner'), $$select public.set_order_status(tests.order_id('dup2'), 'accepted')$$);
select tests.exec_as('authenticated', tests.id('owner'),
  $$select public.set_order_status(tests.order_id('dup2'), 'cancelled', 'out_of_stock')$$);
select tests.expect_true('postgres', null, $$
  select o.payment_status = 'refund_required'
     and exists (select 1 from public.notifications n where n.order_id = o.id and n.user_id = tests.id('bob')
                   and n.status = 'refund_required')
     and (select count(*) from public.notifications n where n.order_id = o.id and n.user_id = tests.id('adm')
            and n.status = 'refund_pending_admin') = 2
  from public.orders o where o.notes = 'dup2'$$,
  'a paid order cancelled: refund_required for the customer, refund_pending_admin for the admins');
select tests.exec_as('authenticated', tests.id('adm'), $$select public.admin_mark_refund_done(tests.pay('dup2', 2))$$);
select tests.expect_true('postgres', null, $$select payment_status = 'refunded' from public.orders where notes = 'dup2'$$,
  'the order is refunded once no payment of it is left to refund');

-- -- reconciliation without a redirect id ---------------------------------------------------------------
select tests.order_of('ana', 'idle');
select tests.prepare('ana', 'idle');
select tests.expect_true('service_role', null, $$
  select not exists (select 1 from public.payments_to_reconcile() where reference = tests.ref('idle', 1))$$,
  'a fresh pending attempt is not reconciled yet');
select tests.age('idle', 4);
select tests.expect_true('service_role', null, $$
  select count(*) = 1 and bool_and(transaction_id is null)
  from public.payments_to_reconcile() where reference = tests.ref('idle', 1)$$,
  'a pending attempt without a redirect id older than 3 minutes is listed (no transaction id)');

-- -- the table stays closed ---------------------------------------------------------------------------
select tests.expect_error('service_role', null, $$select * from public.payments$$, 'permission denied');
select tests.expect_error('service_role', null, $$update public.payments set status = 'error'$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('bob'), $$select private.flag_payment_refund(tests.pay('dup', 1), 'refund_required')$$,
  'permission denied');

rollback;
