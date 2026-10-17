-- -----------------------------------------------------------------------------
-- Business panel: registering, editing and publishing a business.
-- Run like orders_security.sql; rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _business_panel_fixtures.sql

-- -- anon can do nothing --------------------------------------------------------
select tests.expect_error('anon', null,
  $$insert into public.businesses (owner_id, name, category, latitude, longitude, address)
    values (tests.id('owner'), 'Anon', 'Bar', 1, 1, 'Calle 1 # 1')$$, 'permission denied');
select tests.expect_error('anon', null,
  $$update public.businesses set prep_minutes = 30$$, 'permission denied');
select tests.expect_error('anon', null,
  $$insert into public.business_hours (business_id, day_of_week, opens_at, closes_at)
    values (tests.id('eve-biz'), 2, '08:00', '09:00')$$, 'permission denied');
select tests.expect_true('anon', null,
  $$select count(*) = 0 from public.promotions where business_id = tests.id('eve-biz')$$,
  'anon does not see expired promotions');
select tests.expect_true('anon', null,
  $$select not has_function_privilege('anon', 'public.businesses_guard_publish()', 'execute')
    and not has_function_privilege('authenticated', 'public.businesses_guard_publish()', 'execute')$$,
  'nobody can call the trigger function');

-- -- registering: always unpublished, always for oneself ------------------------
select tests.exec_as('authenticated', tests.id('owner'), $$
  insert into public.businesses (owner_id, name, category, latitude, longitude, address, phone, is_active)
  values (tests.id('owner'), 'Mi Fritanga', 'Restaurante', 1.2136, -77.2811,
          'Calle 18 # 25-30', '+57 300 111 2233', true)$$);
-- Fixed id for the rest of the file (as the superuser; clients cannot choose ids).
update public.businesses set id = tests.id('mine') where name = 'Mi Fritanga';
select tests.expect_true('authenticated', tests.id('owner'),
  $$select not is_active and prep_minutes = 20 from public.businesses where id = tests.id('mine')$$,
  'a new business is created unpublished with the default prep time');
select tests.expect_error('authenticated', tests.id('owner'),
  $$insert into public.businesses (owner_id, name, category, latitude, longitude, address)
    values (tests.id('eve'), 'For Eve', 'Bar', 1, 1, 'Calle 1 # 1')$$, 'row-level security');

-- -- constraints mirrored by the app --------------------------------------------
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set category = 'Casino' where id = tests.id('mine')$$, 'businesses_category_valid');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set name = ' x ' where id = tests.id('mine')$$, 'businesses_name_length');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set phone = 'call me' where id = tests.id('mine')$$, 'businesses_phone_format');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set latitude = 91 where id = tests.id('mine')$$, 'businesses_location_range');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set prep_minutes = 4 where id = tests.id('mine')$$, 'businesses_prep_minutes_range');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set prep_minutes = 181 where id = tests.id('mine')$$, 'businesses_prep_minutes_range');
select tests.exec_as('authenticated', tests.id('owner'),
  $$update public.businesses set prep_minutes = 35 where id = tests.id('mine')$$);
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set owner_id = tests.id('eve') where id = tests.id('mine')$$, 'permission denied');

-- -- nobody edits someone else's business ---------------------------------------
select tests.exec_as('authenticated', tests.id('owner'),
  $$update public.businesses set name = 'Hacked', is_active = false where id = tests.id('eve-biz')$$);
select tests.expect_true('authenticated', tests.id('eve'),
  $$select name = 'Eve Bar' and is_active from public.businesses where id = tests.id('eve-biz')$$,
  'an update on another owner''s business changes nothing');

-- -- publishing requires an open day and an available item -----------------------
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set is_active = true where id = tests.id('mine')$$, 'publish_requirements_missing');
select tests.exec_as('authenticated', tests.id('owner'), $$
  insert into public.business_hours (business_id, day_of_week, opens_at, closes_at, is_closed)
  values (tests.id('mine'), 1, '08:00', '18:00', true)$$);
select tests.exec_as('authenticated', tests.id('owner'), $$
  insert into public.menu_items (business_id, name, price_cop, is_available)
  values (tests.id('mine'), 'Fritanga', 18000, false)$$);
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set is_active = true where id = tests.id('mine')$$, 'publish_requirements_missing');
-- Upsert the same day (one row per day) to open it, and make the item available.
select tests.exec_as('authenticated', tests.id('owner'), $$
  insert into public.business_hours (business_id, day_of_week, opens_at, closes_at, is_closed)
  values (tests.id('mine'), 1, '18:00', '02:00', false)
  on conflict (business_id, day_of_week) do update
    set business_id = excluded.business_id, opens_at = excluded.opens_at,
        closes_at = excluded.closes_at, is_closed = excluded.is_closed$$);
select tests.expect_true('authenticated', tests.id('owner'),
  $$select count(*) = 1 and bool_and(not is_closed) from public.business_hours where business_id = tests.id('mine')$$,
  'upsert keeps one row per day');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set is_active = true where id = tests.id('mine')$$, 'publish_requirements_missing');
select tests.exec_as('authenticated', tests.id('owner'),
  $$update public.menu_items set is_available = true where business_id = tests.id('mine')$$);
select tests.exec_as('authenticated', tests.id('owner'),
  $$update public.businesses set is_active = true where id = tests.id('mine')$$);
select tests.expect_true('anon', null,
  $$select count(*) = 1 from public.businesses where id = tests.id('mine')$$, 'published business is public');
select tests.exec_as('authenticated', tests.id('owner'),
  $$update public.businesses set is_active = false where id = tests.id('mine')$$);
select tests.expect_true('anon', null,
  $$select count(*) = 0 from public.businesses where id = tests.id('mine')$$, 'unpublishing is always allowed');

rollback;
