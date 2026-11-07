-- -----------------------------------------------------------------------------
-- expire_abandoned_payments (20261115000000_abandoned_payments.sql): attempts that never
-- reached Wompi close themselves after their expiry plus a grace period; anything with a
-- transaction id or an event is left to the reconciliation; a late approval is still
-- recorded and refunded; only service_role runs it.
-- Roles: customers ana and bob, anon, service_role. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _orders_fixtures.sql
update public.app_settings set int_value = 1 where key = 'payments_enabled';
update public.app_settings set int_value = 100 where key in ('trust_new_max_pending_pickup', 'trust_new_max_daily');

create function tests.attempt(p_user text, p_note text) returns void language plpgsql as $$
begin
  perform tests.become('authenticated', tests.id(p_user));
  perform public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '1')), null, p_note, 'online');
  perform public.prepare_payment(tests.order_id(p_note), 'test');
  perform tests.restore();
end $$;
-- Moves an order's attempts p_minutes into the past (created_at and expires_at).
create function tests.age(p_note text, p_minutes int) returns void language plpgsql as $$
begin
  alter table public.payments disable trigger payments_guard;
  update public.payments set created_at = created_at - make_interval(mins => p_minutes),
                             expires_at = expires_at - make_interval(mins => p_minutes)
  where order_id = tests.order_id(p_note);
  alter table public.payments enable trigger payments_guard;
end $$;
create function tests.status(p_note text) returns text language sql stable security definer set search_path = ''
as $$ select status from public.payments where order_id = tests.order_id(p_note) order by attempt desc limit 1 $$;
create function tests.ref(p_note text) returns text language sql stable security definer set search_path = ''
as $$ select reference from public.payments where order_id = tests.order_id(p_note) $$;
grant execute on function tests.ref(text) to service_role;
create function tests.order_payment(p_note text) returns text language sql stable security definer set search_path = ''
as $$ select payment_status from public.orders where id = tests.order_id(p_note) $$;

select tests.attempt('ana', 'abandoned');
select tests.attempt('bob', 'fresh');
select tests.attempt('ana', 'with-tx');
select tests.attempt('bob', 'with-event');
select tests.age('abandoned', 120);
select tests.age('with-tx', 120);
select tests.age('with-event', 120);
select tests.age('fresh', 20);
update public.payments set candidate_transaction_id = 'tx-known' where order_id = tests.order_id('with-tx');
select public.apply_payment_event(tests.ref('with-event'),
  'tx-pending', 'PENDING', 600000, 'COP', 'test', 'CARD', 'webhook');
-- The expiry job has already cancelled the old unpaid orders (expire_stale_orders).
update public.orders set status = 'cancelled', cancel_reason = 'payment_expired'
where id in (tests.order_id('abandoned'), tests.order_id('with-tx'), tests.order_id('with-event'));

select tests.expect_error('anon', null, $$select public.expire_abandoned_payments()$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('ana'), $$select public.expire_abandoned_payments()$$, 'permission denied');

select tests.expect_true('service_role', null, $$select public.expire_abandoned_payments() = 1$$,
  'one attempt closes: the one that never reached Wompi');
select tests.expect_true('postgres', null, $$select tests.status('abandoned') = 'expired'
  and tests.order_payment('abandoned') = 'expired'$$, 'the attempt and its order say expired, no longer pending');
select tests.expect_true('postgres', null, $$select tests.status('fresh') = 'pending'$$,
  'inside its expiry plus grace it stays pending: the customer may still be paying');
select tests.expect_true('postgres', null, $$select tests.status('with-tx') = 'pending'
  and tests.status('with-event') = 'pending'$$, 'with a transaction id or an event the reconciliation decides, not this');
select tests.expect_true('service_role', null, $$select public.expire_abandoned_payments(0) = 0$$,
  'a second run changes nothing, and the grace never drops below 15 minutes');
select tests.expect_true('postgres', null, $$select tests.status('fresh') = 'pending'$$,
  'the 20-minute-old attempt is still inside the minimum grace');

select tests.expect_true('postgres', null, $$select not exists (
  select 1 from public.payments p where p.order_id = tests.order_id('abandoned') and p.status = 'pending'
    and p.created_at < now() - interval '1 hour')$$, 'Pagos con problemas no longer lists it as stuck');

select tests.expect_true('service_role', null, $$select public.apply_payment_event(
  tests.ref('abandoned'),
  'tx-late', 'APPROVED', 600000, 'COP', 'test', 'CARD', 'webhook') = 'applied'$$,
  'if Wompi reports it late after all, the approval is recorded');
select tests.expect_true('postgres', null, $$select tests.status('abandoned') = 'refund_required'
  and tests.order_payment('abandoned') = 'refund_required'$$, 'and, the order being cancelled, it is refunded');

rollback;
