-- -----------------------------------------------------------------------------
-- Online payments: the state machine (vectors shared with TypeScript),
-- payment_config, prepare_payment, apply_payment_event (idempotency,
-- mismatches, approval, retries, late events), record_payment_redirect and
-- payments_to_reconcile. Roles: anon, customers ana and bob, owner of b1,
-- service_role. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _orders_fixtures.sql

-- -- state machine: every vector of supabase/tests/fixtures/payment_transitions.json -----
create temporary table vectors as
select v ->> 'from' as from_status, v ->> 'to' as to_status, (v ->> 'allowed')::boolean as allowed
from jsonb_array_elements((:'payment_vectors')::jsonb -> 'vectors') v;
grant select on vectors to authenticated;
select tests.expect_true('authenticated', tests.id('ana'), $$
  select count(*) = 49 and bool_and(public.payment_transition_allowed(from_status, to_status) = allowed) from vectors$$,
  'payment_transition_allowed matches all 49 shared vectors');

-- -- config and preparing an attempt -----------------------------------------------------------
select tests.expect_true('authenticated', tests.id('ana'),
  $$select not enabled and sandbox from public.payment_config()$$, 'off and sandbox by default');
select tests.expect_error('anon', null, $$select * from public.payment_config()$$, 'permission denied');
update public.app_settings set int_value = 1 where key = 'payments_enabled';
select tests.exec_as('authenticated', tests.id('bob'), $$select public.create_order(tests.id('b1'),
  jsonb_build_array(tests.line('m1', '2')), null, 'pay-1', 'online')$$);
select tests.exec_as('authenticated', tests.id('ana'), $$select public.create_order(tests.id('b1'),
  jsonb_build_array(tests.line('m4', '1')), null, 'cash-1')$$);

select tests.expect_error('anon', null, $$select * from public.prepare_payment(tests.order_id('pay-1'), 'test')$$,
  'permission denied');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select * from public.prepare_payment(tests.order_id('pay-1'), 'test')$$, 'order_not_found');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select * from public.prepare_payment(tests.order_id('cash-1'), 'test')$$, 'order_not_payable');
select tests.expect_error('authenticated', tests.id('bob'),
  $$select * from public.prepare_payment(tests.order_id('pay-1'), 'prod')$$, 'payments_misconfigured');
select tests.expect_true('authenticated', tests.id('bob'), $$
  select reference ~ '^luma_[0-9a-f]{32}$' and amount_in_cents = 1200000 and currency = 'COP' and attempt = 1
     and expires_at > now()
  from public.prepare_payment(tests.order_id('pay-1'), 'test')$$,
  'the amount comes from orders.total_cop, in cents, with an unpredictable reference');
select tests.exec_as('authenticated', tests.id('bob'), $$select * from public.prepare_payment(tests.order_id('pay-1'), 'test')$$);
select tests.exec_as('authenticated', tests.id('bob'), $$select * from public.prepare_payment(tests.order_id('pay-1'), 'test')$$);
select tests.expect_error('authenticated', tests.id('bob'),
  $$select * from public.prepare_payment(tests.order_id('pay-1'), 'test')$$, 'too_many_attempts');
select tests.expect_true('postgres', null,
  $$select count(distinct reference) = 3 from public.payments where order_id = tests.order_id('pay-1')$$,
  'each attempt has its own reference');
select tests.expect_true('authenticated', tests.id('bob'), $$
  select payment_status = 'pending' and attempts_used = 3 and attempts_max = 3
  from public.my_order_payment(tests.order_id('pay-1'))$$, 'the customer sees attempts and status');
select tests.expect_true('authenticated', tests.id('ana'),
  $$select count(*) = 0 from public.my_order_payment(tests.order_id('pay-1'))$$, 'nobody else does');
select tests.expect_error('authenticated', tests.id('bob'), $$select * from public.payments$$, 'permission denied');

-- References of the attempts, by attempt number.
create function tests.ref(p_attempt int) returns text language sql stable security definer set search_path = ''
as $$ select reference from public.payments where order_id = tests.order_id('pay-1') and attempt = p_attempt $$;
grant execute on function tests.ref(int) to service_role, authenticated;
create function tests.event(p_attempt int, p_tx text, p_status text, p_amount bigint default 1200000,
                            p_currency text default 'COP', p_env text default 'test') returns text language sql
as $$ select public.apply_payment_event(tests.ref(p_attempt), p_tx, p_status, p_amount, p_currency, p_env, 'CARD', 'webhook') $$;
grant execute on function tests.event(int, text, text, bigint, text, text) to service_role, authenticated;

-- -- apply_payment_event --------------------------------------------------------------------------
select tests.expect_error('authenticated', tests.id('bob'), $$select tests.event(1, '1-1-1', 'APPROVED')$$,
  'permission denied');
select tests.expect_true('service_role', null,
  $$select public.apply_payment_event('luma_00000000000000000000000000000000', '9-9-9', 'APPROVED', 1, 'COP', 'test', null, 'webhook')
           = 'unknown_reference'$$, 'an unknown reference changes nothing');
select tests.expect_error('service_role', null, $$select tests.event(1, 'bad id!', 'APPROVED')$$, 'invalid_event');
select tests.expect_true('service_role', null, $$select tests.event(1, '1-1-a', 'APPROVED', 1100000) = 'mismatch'$$,
  'a different amount never approves');
select tests.expect_true('service_role', null, $$select tests.event(1, '1-1-b', 'APPROVED', 1200000, 'USD') = 'mismatch'$$,
  'a different currency never approves');
select tests.expect_true('service_role', null,
  $$select tests.event(1, '1-1-c', 'APPROVED', 1200000, 'COP', 'prod') = 'mismatch'$$, 'another environment never approves');
select tests.expect_true('postgres', null, $$
  select o.status = 'awaiting_payment' and o.payment_status = 'pending' from public.orders o where o.notes = 'pay-1'$$,
  'mismatches leave the order waiting');

select tests.expect_true('service_role', null, $$select tests.event(3, '3-1', 'DECLINED') = 'applied'$$, 'a decline applies');
select tests.expect_true('postgres', null, $$
  select payment_status = 'declined' and status = 'awaiting_payment' from public.orders where notes = 'pay-1'$$,
  'declined: still waiting, the customer may retry');
select tests.expect_true('service_role', null, $$select tests.event(3, '3-2', 'APPROVED') = 'applied'$$,
  'the retry of the same reference approves (decline -> approved)');
select tests.expect_true('postgres', null, $$
  select o.status = 'pending' and o.payment_status = 'approved'
     and exists (select 1 from public.notifications n where n.order_id = o.id and n.type = 'order_new' and n.user_id = tests.id('owner'))
     and exists (select 1 from public.notifications n where n.order_id = o.id and n.type = 'payment' and n.status = 'approved')
  from public.orders o where o.notes = 'pay-1'$$,
  'approved: the order reaches the business and only now the owner is told');
select tests.expect_true('authenticated', tests.id('owner'), $$
  select payment_status = 'approved' and payment_method = 'online' from public.business_orders where notes = 'pay-1'$$,
  'the owner sees "Pagado en linea"');
select tests.expect_true('service_role', null, $$select tests.event(3, '3-2', 'APPROVED') = 'duplicate'$$,
  'the same event twice changes nothing');
select tests.expect_true('service_role', null, $$select tests.event(3, '3-1', 'DECLINED') = 'duplicate'$$,
  'a repeated older decline is a duplicate');
select tests.expect_true('service_role', null, $$select tests.event(1, '1-9', 'DECLINED') = 'applied'$$,
  'a late decline of an older attempt is recorded');
select tests.expect_true('postgres', null, $$select payment_status = 'approved' from public.orders where notes = 'pay-1'$$,
  'but never overwrites the approved order');
select tests.expect_true('service_role', null, $$select tests.event(3, '3-3', 'DECLINED') = 'ignored'$$,
  'an approval never goes back');

-- -- redirect id and reconcile list --------------------------------------------------------------------
select tests.expect_true('authenticated', tests.id('bob'),
  $$select public.record_payment_redirect(tests.order_id('pay-1'), '2-77')$$, 'the customer stores the redirect id');
select tests.expect_true('authenticated', tests.id('ana'),
  $$select public.record_payment_redirect(tests.order_id('pay-1'), '2-78') is null$$, 'only for their own order');
select tests.expect_true('authenticated', tests.id('bob'),
  $$select public.record_payment_redirect(tests.order_id('pay-1'), 'x; drop') is null$$, 'malformed ids are refused');
alter table public.payments disable trigger payments_guard;
update public.payments set created_at = created_at - interval '5 minutes' where order_id = tests.order_id('pay-1') and attempt = 2;
alter table public.payments enable trigger payments_guard;
select tests.expect_error('authenticated', tests.id('bob'), $$select * from public.payments_to_reconcile()$$,
  'permission denied');
select tests.expect_true('service_role', null, $$
  select count(*) = 1 and bool_and(transaction_id = '2-77' and environment = 'test') from public.payments_to_reconcile()$$,
  'open attempts with a redirect id older than 3 minutes are reconciled');

rollback;
