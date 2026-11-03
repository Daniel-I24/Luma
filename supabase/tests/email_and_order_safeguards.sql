-- -----------------------------------------------------------------------------
-- Confirmed email on every write that matters, and the order safeguards
-- (hourly caps, owner cancellations, expiry). Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql

-- unc: signed up but never confirmed the email (owner account, to try everything).
insert into auth.users (id, email, email_confirmed_at) values (tests.id('unc'), 'unc@test.local', null);
update public.profiles set account_type = 'business_owner' where id = tests.id('unc');
insert into auth.users (id, email, email_confirmed_at) values (tests.id('unc2'), 'unc2@test.local', null);

-- -- confirmed email ----------------------------------------------------------------
select tests.expect_true('authenticated', tests.id('cus'), $$select public.is_email_confirmed()$$, 'confirmed user');
select tests.expect_true('authenticated', tests.id('unc'), $$select not public.is_email_confirmed()$$, 'unconfirmed user');
select tests.expect_error('anon', null, $$select public.is_email_confirmed()$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('unc'),
  $$select public.create_order(tests.id('pub'), jsonb_build_array(tests.line_of('mpub', 1)))$$, 'email_not_confirmed');
select tests.expect_error('authenticated', tests.id('unc2'), $$select public.become_business_owner()$$, 'email_not_confirmed');
select tests.expect_error('authenticated', tests.id('unc'), $$
  insert into public.businesses (owner_id, name, category, latitude, longitude, address)
  values (tests.id('unc'), 'Sin confirmar', 'Bar', 1.21, -77.28, 'Calle 1 # 1-1')$$, 'email_not_confirmed');
select tests.expect_error('authenticated', tests.id('unc'),
  $$select public.submit_business_for_review(tests.id('v1'))$$, 'email_not_confirmed');
select tests.expect_error('authenticated', tests.id('unc'), $$
  insert into public.reviews (business_id, rating) values (tests.id('pub'), 5)$$,
  'email_not_confirmed');
select tests.expect_error('authenticated', tests.id('unc'), $$
  insert into public.reports (business_id, reason) values (tests.id('pub'), 'other')$$, 'email_not_confirmed');
select tests.expect_error('authenticated', tests.id('unc'), $$select public.consume_ai_quota()$$, 'email_not_confirmed');

-- -- hourly caps (all statuses count) -------------------------------------------------
update public.app_settings set int_value = 3 where key = 'order_max_per_hour_per_user';
insert into public.businesses (id, owner_id, name, category, latitude, longitude, address, is_active) values
  (tests.id('pub2'), tests.id('eve'), 'Otro Café', 'Cafetería', 1.21, -77.28, 'Calle 20 # 1-1', true);
update public.businesses set verification_status = 'approved' where id = tests.id('pub2');
insert into public.business_hours (business_id, day_of_week, opens_at, closes_at)
select tests.id('pub2'), d, '00:00', '23:59:59.999999' from generate_series(0, 6) d;
insert into public.menu_items (id, business_id, name, price_cop) values (tests.id('m2'), tests.id('pub2'), 'Pan', 1000);

select tests.exec_as('authenticated', tests.id('cus'), $$
  select public.create_order(tests.id('pub'), jsonb_build_array(tests.line_of('mpub', 1)))$$);
select tests.exec_as('authenticated', tests.id('cus'), $$
  select public.cancel_order((select id from public.orders order by created_at desc limit 1))$$);
select tests.exec_as('authenticated', tests.id('cus'), $$
  select public.create_order(tests.id('pub'), jsonb_build_array(tests.line_of('mpub', 1)))$$);
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.create_order(tests.id('pub'), jsonb_build_array(tests.line_of('mpub', 1)))$$, 'too_many_orders');
select tests.exec_as('authenticated', tests.id('cus'), $$
  select public.create_order(tests.id('pub2'), jsonb_build_array(tests.line_of('m2', 1)))$$);
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.create_order(tests.id('pub2'), jsonb_build_array(tests.line_of('m2', 1)))$$, 'too_many_orders');

-- The final create_order keeps every protection.
select tests.expect_true('postgres', null, $$
  select bool_and(position(m in pg_get_functiondef('public.create_order(uuid, jsonb, timestamptz, text, text)'::regprocedure)) > 0)
  from unnest(array['not_authenticated', 'email_not_confirmed', 'is_business_public', 'invalid_items',
    'duplicate_items', 'item_unavailable', 'order_line_prices', 'invalid_pickup_time', 'business_closed',
    'invalid_notes', 'total_too_high', 'too_many_pending', 'too_many_orders', 'pg_advisory_xact_lock']) m$$,
  'create_order still has every protection');

-- -- owners cancel after accepting --------------------------------------------------
select tests.exec_as('authenticated', tests.id('owner'), $$
  select public.set_order_status((select id from public.business_orders where business_id = tests.id('pub') and status = 'pending' limit 1), 'accepted')$$);
select tests.exec_as('authenticated', tests.id('owner'), $$
  select public.set_order_status((select id from public.business_orders where business_id = tests.id('pub') and status = 'accepted' limit 1), 'cancelled', 'out_of_stock')$$);
select tests.expect_true('postgres', null,
  $$select count(*) = 2 from public.orders where business_id = tests.id('pub') and status = 'cancelled'$$,
  'accepted orders can be cancelled by the owner');
select tests.expect_error('authenticated', tests.id('eve'), $$
  select public.set_order_status(tests.id('none'), 'cancelled')$$,
  'order_not_found');

-- -- expiry ---------------------------------------------------------------------------
delete from public.orders;
insert into public.orders (id, user_id, business_id, business_name, business_address, total_cop, created_at, pickup_at) values
  (tests.id('old-now'), tests.id('cus'), tests.id('pub'), 'Café', 'Calle', 2000, now() - interval '40 minutes', null),
  (tests.id('fresh'), tests.id('cus'), tests.id('pub'), 'Café', 'Calle', 2000, now() - interval '10 minutes', null),
  (tests.id('sched-late'), tests.id('cus'), tests.id('pub'), 'Café', 'Calle', 2000, now() - interval '3 hours', now() - interval '31 minutes'),
  (tests.id('sched-soon'), tests.id('cus'), tests.id('pub'), 'Café', 'Calle', 2000, now() - interval '3 hours', now() + interval '1 hour');
select tests.expect_error('anon', null, $$select public.expire_stale_orders()$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('owner'), $$select public.expire_stale_orders()$$, 'permission denied');
select tests.expect_true('service_role', null, $$select public.expire_stale_orders() = 2$$, 'two stale orders expire');
select tests.expect_true('postgres', null, $$
  select (select array_agg(id order by id) from public.orders where status = 'cancelled')
           = (select array_agg(x order by x) from unnest(array[tests.id('old-now'), tests.id('sched-late')]) x)
     and (select count(*) from public.notifications
          where user_id = tests.id('cus') and type = 'order_status' and status = 'cancelled') = 2$$,
  'only stale ones are cancelled and the customer is told');

rollback;
