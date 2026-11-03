-- -----------------------------------------------------------------------------
-- Service RPCs of the payment functions: payment_event_seen, payment_attempt
-- (service_role only), admin_note_reconcile (admin with aal2, logged) and the
-- private cron settings. Roles: customer bob, admin (adm), anon,
-- service_role. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _orders_fixtures.sql
insert into auth.users (id, email) values (tests.id('adm'), 'adm@test.local');
insert into public.admins (user_id) values (tests.id('adm'));
update public.app_settings set int_value = 1 where key = 'payments_enabled';
select tests.exec_as('authenticated', tests.id('bob'), $$select public.create_order(tests.id('b1'),
  jsonb_build_array(tests.line('m1', '1')), null, 'svc', 'online')$$);
select tests.exec_as('authenticated', tests.id('bob'), $$select * from public.prepare_payment(tests.order_id('svc'), 'test')$$);
create function tests.svc_ref() returns text language sql stable security definer set search_path = ''
as $$ select reference from public.payments where order_id = tests.order_id('svc') $$;
grant execute on function tests.svc_ref() to service_role, authenticated;

select tests.expect_error('authenticated', tests.id('bob'), $$select public.payment_event_seen('1-1', 'APPROVED')$$,
  'permission denied');
select tests.expect_error('authenticated', tests.id('bob'), $$select * from public.payment_attempt(tests.svc_ref())$$,
  'permission denied');
select tests.expect_true('service_role', null, $$
  select amount_in_cents = 600000 and currency = 'COP' and environment = 'test' and status = 'pending'
  from public.payment_attempt(tests.svc_ref())$$, 'the function reads the attempt it must match');
select tests.expect_true('service_role', null, $$select not public.payment_event_seen('7-7', 'APPROVED')$$, 'unseen event');
select tests.exec_as('service_role', null, $$
  select public.apply_payment_event(tests.svc_ref(), '7-7', 'APPROVED', 600000, 'COP', 'test', 'CARD', 'webhook')$$);
select tests.expect_true('service_role', null, $$select public.payment_event_seen('7-7', 'APPROVED')$$, 'seen after applying');

select tests.expect_error('authenticated', tests.id('bob'), $$select public.admin_note_reconcile()$$, 'not_admin');
select tests.use_aal('aal1');
select tests.expect_error('authenticated', tests.id('adm'), $$select public.admin_note_reconcile()$$, 'not_admin');
select tests.use_aal('aal2');
select tests.exec_as('authenticated', tests.id('adm'), $$select public.admin_note_reconcile()$$);
select tests.expect_true('authenticated', tests.id('adm'),
  $$select exists (select 1 from public.admin_recent_audit(5) where action = 'reconcile_payments')$$, 'logged');
select tests.expect_error('anon', null, $$select public.admin_note_reconcile()$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('adm'), $$select * from private.payments_cron$$, 'permission denied');

rollback;
