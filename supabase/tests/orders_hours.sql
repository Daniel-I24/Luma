-- -----------------------------------------------------------------------------
-- create_order checks the business hours on the server (America/Bogota):
-- "Ahora" against now(), a scheduled order against its time.
-- Run like orders_security.sql; rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _orders_fixtures.sql

-- c1: closed every day. c2: open only from 30 minutes before to 30 minutes
-- after "now + 1 hour" (local time; time arithmetic wraps around midnight,
-- which then makes the row cross midnight).
insert into public.businesses (id, owner_id, name, category, latitude, longitude, address, is_active) values
  (tests.id('c1'), tests.id('owner'), 'Closed All Week', 'Bar', 1.21, -77.28, 'Calle 7 # 1-1', true),
  (tests.id('c2'), tests.id('owner'), 'Narrow Window', 'Bar', 1.21, -77.28, 'Calle 8 # 1-1', true);
insert into public.business_hours (business_id, day_of_week, opens_at, closes_at, is_closed)
select tests.id('c1'), d, '08:00', '18:00', true from generate_series(0, 6) d;
insert into public.business_hours (business_id, day_of_week, opens_at, closes_at)
select tests.id('c2'), d,
       (public.app_local_time(now() + interval '1 hour') - interval '30 minutes')::time,
       (public.app_local_time(now() + interval '1 hour') + interval '30 minutes')::time
from generate_series(0, 6) d;
insert into public.menu_items (id, business_id, name, price_cop) values
  (tests.id('mc1'), tests.id('c1'), 'Cerveza', 7000),
  (tests.id('mc2'), tests.id('c2'), 'Cerveza', 7000);

select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('c1'), jsonb_build_array(tests.line('mc1', '1')))$$, 'business_closed');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('c1'), jsonb_build_array(tests.line('mc1', '1')),
    now() + interval '2 days')$$, 'business_closed');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('c2'), jsonb_build_array(tests.line('mc2', '1')))$$, 'business_closed');
select tests.exec_as('authenticated', tests.id('ana'), $$
  select public.create_order(tests.id('c2'), jsonb_build_array(tests.line('mc2', '1')),
    now() + interval '1 hour', 'inside-window')$$);
select tests.expect_true('authenticated', tests.id('ana'),
  $$select count(*) = 1 from public.orders where notes = 'inside-window'$$, 'scheduled inside the hours');
select tests.expect_error('authenticated', tests.id('ana'),
  $$select public.create_order(tests.id('c2'), jsonb_build_array(tests.line('mc2', '1')),
    now() + interval '3 hours')$$, 'business_closed');
select tests.expect_true('anon', null,
  $$select not has_function_privilege('anon', 'public.business_open_at(uuid, timestamptz)', 'execute')
       and not has_function_privilege('authenticated', 'public.app_local_time(timestamptz)', 'execute')$$,
  'clients cannot call the hours helpers directly');

rollback;
