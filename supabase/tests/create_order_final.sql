-- -----------------------------------------------------------------------------
-- The final create_order: one check per protection, so the suite fails if any
-- of them is lost. Also order pause (set_orders_paused) and trust tiers in
-- create_order. Roles: anon, customers (ana, bob, inc incomplete, unc
-- unconfirmed), owner of b1, another user (eve). Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _orders_fixtures.sql
insert into auth.users (id, email) values (tests.id('inc'), 'inc@test.local'), (tests.id('eve'), 'eve@test.local');
insert into auth.users (id, email, email_confirmed_at) values (tests.id('unc'), 'unc@test.local', null);
select tests.complete_profile('unc');
update public.app_settings set int_value = 100 where key in ('order_max_per_hour_per_user', 'order_max_per_hour_per_business');

create function tests.order_sql(p_extra text default '') returns text language sql immutable
as $$ select format($f$select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '1'))%s)$f$, p_extra) $$;

-- -- who may order ---------------------------------------------------------------------
select tests.expect_error('anon', null, tests.order_sql(), 'permission denied');
select tests.expect_error('authenticated', null, tests.order_sql(), 'not_authenticated');
select tests.expect_error('authenticated', tests.id('unc'), tests.order_sql(), 'email_not_confirmed');
select tests.expect_error('authenticated', tests.id('inc'), tests.order_sql(), 'profile_incomplete');
update public.app_settings set int_value = 1 where key = 'require_phone_verification';
select tests.expect_error('authenticated', tests.id('ana'), tests.order_sql(), 'phone_not_verified');
update public.app_settings set int_value = 0 where key = 'require_phone_verification';

-- -- the business ------------------------------------------------------------------------
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b3'), jsonb_build_array(tests.line('m5', '1')))$$, 'business_unavailable');
select tests.expect_error('authenticated', tests.id('eve'),
  $$select public.set_orders_paused(tests.id('b1'), 30)$$, 'not_business_owner');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.set_orders_paused(tests.id('b1'), 45)$$, 'invalid_pause');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select public.set_orders_paused(tests.id('b1'), 30) > now() + interval '29 minutes'$$, 'the owner pauses for 30 minutes');
select tests.expect_true('anon', null,
  $$select orders_paused_until > now() from public.businesses where id = tests.id('b1')$$, 'customers see the pause');
select tests.expect_error('authenticated', tests.id('ana'), tests.order_sql(), 'business_paused');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select public.set_orders_paused(tests.id('b1'), -1) = 'infinity'$$, 'until resumed');
select tests.expect_error('authenticated', tests.id('ana'), tests.order_sql(), 'business_paused');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select public.set_orders_paused(tests.id('b1'), 0) is null$$, 'resume returns no end');
select tests.expect_true('authenticated', tests.id('ana'), $$select not public.business_paused(tests.id('b1'))$$, 'resumed');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set orders_paused_until = null where id = tests.id('b1')$$, 'permission denied');

-- -- the items -----------------------------------------------------------------------------
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b1'), '{"x": 1}')$$, 'invalid_items');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '"2"')))$$, 'invalid_items');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m1', '1'), tests.line('m1', '2')))$$,
  'duplicate_items');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m2', '1')))$$, 'item_unavailable');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('b1'), jsonb_build_array(tests.line('m3', '1')))$$, 'item_unavailable');
select tests.expect_error('authenticated', tests.id('ana'),
  tests.order_sql(', now() + interval ''2 minutes'''), 'invalid_pickup_time');
select tests.expect_error('authenticated', tests.id('ana'), tests.order_sql(', null, repeat(''x'', 201)'), 'invalid_notes');
update public.app_settings set int_value = 5000 where key = 'order_max_total_cop';
select tests.expect_error('authenticated', tests.id('ana'), tests.order_sql(), 'total_too_high');
update public.app_settings set int_value = 500000 where key = 'order_max_total_cop';
delete from public.business_hours where business_id = tests.id('b1');
select tests.expect_error('authenticated', tests.id('ana'), tests.order_sql(), 'business_closed');
insert into public.business_hours (business_id, day_of_week, opens_at, closes_at)
select tests.id('b1'), d, '00:00', '23:59:59.999999' from generate_series(0, 6) d;
select tests.exec_as('authenticated', tests.id('ana'), $$select public.create_order(tests.id('b1'),
  jsonb_build_array(tests.line('m1', '2', '{"price_cop": 1, "unit_price_cop": 1}')), null, 'precio')$$);
select tests.expect_true('authenticated', tests.id('ana'),
  $$select total_cop = 12000 from public.orders where notes = 'precio'$$,
  'prices come from the server; client prices are ignored');

-- -- payment method -------------------------------------------------------------------------
select tests.expect_error('authenticated', tests.id('bob'), tests.order_sql(', null, null, ''cash'''), 'invalid_payment_method');
select tests.expect_error('authenticated', tests.id('bob'), tests.order_sql(', null, null, ''online'''), 'payments_disabled');
update public.app_settings set int_value = 1 where key = 'payments_enabled';
select tests.exec_as('authenticated', tests.id('bob'), tests.order_sql(', null, ''online-1'', ''online'''));
select tests.expect_true('postgres', null, $$
  select status = 'awaiting_payment' and payment_method = 'online' and payment_status = 'none'
     and not exists (select 1 from public.notifications n where n.order_id = o.id)
  from public.orders o where notes = 'online-1'$$,
  'an online order waits for its payment and the owner is not told');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select not exists (select 1 from public.business_orders where notes = 'online-1')$$,
  'the business does not see an unpaid online order');

-- -- trust tiers ------------------------------------------------------------------------------
update public.app_settings set int_value = 1 where key = 'trust_new_max_pending_pickup';
update public.app_settings set int_value = 3 where key = 'trust_new_max_daily';
select tests.expect_error('authenticated', tests.id('ana'), tests.order_sql(), 'trust_pending_limit');
select tests.exec_as('authenticated', tests.id('bob'), tests.order_sql());
select tests.exec_as('authenticated', tests.id('bob'), tests.order_sql(', null, ''online-2'', ''online'''));
select tests.expect_error('authenticated', tests.id('bob'), tests.order_sql(', null, null, ''online'''), 'trust_daily_limit');
insert into public.orders (user_id, business_id, business_name, business_address, total_cop, status, cancel_reason, cancelled_at)
select tests.id('eve'), tests.id('b1'), 'T', 'C', 1, 'cancelled', 'no_show', now() - make_interval(days => n)
from generate_series(1, 3) n;
select tests.complete_profile('eve');
select tests.expect_error('authenticated', tests.id('eve'), tests.order_sql(), 'account_restricted');
select tests.exec_as('authenticated', tests.id('eve'), tests.order_sql(', null, ''eve-online'', ''online'''));
update public.app_settings set int_value = 0 where key = 'payments_enabled';
select tests.expect_error('authenticated', tests.id('eve'), tests.order_sql(', null, null, ''online'''), 'payments_disabled');

-- -- pending and hourly caps (awaiting_payment counts as pending) --------------------------------
update public.app_settings set int_value = 100 where key in ('trust_new_max_pending_pickup', 'trust_new_max_daily');
update public.app_settings set int_value = 2 where key = 'order_max_pending_per_user';
select tests.expect_error('authenticated', tests.id('bob'), tests.order_sql(), 'too_many_pending');
update public.app_settings set int_value = 5 where key = 'order_max_pending_per_user';
update public.app_settings set int_value = 3 where key = 'order_max_per_hour_per_user';
select tests.expect_error('authenticated', tests.id('bob'), tests.order_sql(), 'too_many_orders');

-- -- no protection may disappear ------------------------------------------------------------------
select tests.expect_true('postgres', null, $$
  select bool_and(position(m in pg_get_functiondef('public.create_order(uuid, jsonb, timestamptz, text, text)'::regprocedure)) > 0)
  from unnest(array['not_authenticated', 'email_not_confirmed', 'profile_incomplete', 'phone_check_passed',
    'is_business_public', 'business_paused', 'invalid_items', 'duplicate_items', 'item_unavailable', 'order_line_prices',
    'invalid_pickup_time', 'business_closed', 'invalid_notes', 'total_too_high', 'invalid_payment_method',
    'payments_disabled', 'customer_trust_tier', 'account_restricted', 'trust_pending_limit', 'trust_daily_limit',
    'too_many_pending', 'awaiting_payment', 'too_many_orders', 'pg_advisory_xact_lock']) m$$,
  'create_order keeps every protection');
select tests.expect_true('postgres', null,
  $$select count(*) = 1 from pg_proc where proname = 'create_order' and pronamespace = 'public'::regnamespace$$,
  'there is exactly one create_order');

rollback;
