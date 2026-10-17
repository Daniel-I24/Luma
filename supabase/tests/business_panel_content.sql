-- -----------------------------------------------------------------------------
-- Business panel: hours, menu and promotions of a business.
-- Run like orders_security.sql; rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _business_panel_fixtures.sql

-- An unpublished business of owner with one open day.
insert into public.businesses (id, owner_id, name, category, latitude, longitude, address, is_active) values
  (tests.id('mine'), tests.id('owner'), 'Mi Fritanga', 'Restaurante', 1.21, -77.28, 'Calle 18 # 25-30', false);
insert into public.business_hours (business_id, day_of_week, opens_at, closes_at) values
  (tests.id('mine'), 1, '18:00', '02:00');

-- -- hours: never on someone else's business ------------------------------------
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into public.business_hours (business_id, day_of_week, opens_at, closes_at)
  values (tests.id('eve-biz'), 3, '08:00', '09:00')$$, 'row-level security');
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into public.business_hours (business_id, day_of_week, opens_at, closes_at)
  values (tests.id('eve-biz'), 1, '08:00', '09:00')
  on conflict (business_id, day_of_week) do update set opens_at = excluded.opens_at$$, 'row-level security');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.business_hours set business_id = tests.id('eve-biz') where business_id = tests.id('mine')$$,
  'row-level security');
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into public.business_hours (business_id, day_of_week, opens_at, closes_at)
  values (tests.id('mine'), 2, '08:00', '08:00')$$, 'business_hours_open_differs');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select count(*) = 1 from public.business_hours where business_id = tests.id('mine')$$,
  'owner reads the hours of an unpublished business');
select tests.expect_true('authenticated', tests.id('eve'),
  $$select count(*) = 0 from public.business_hours where business_id = tests.id('mine')$$,
  'others do not read the hours of an unpublished business');

-- -- menu and promotions --------------------------------------------------------
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into public.menu_items (business_id, name, price_cop) values (tests.id('eve-biz'), 'Spam', 1)$$,
  'row-level security');
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into public.menu_items (business_id, name, price_cop) values (tests.id('mine'), 'Negative', -1)$$,
  'check constraint');
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into public.promotions (business_id, title, starts_at, ends_at)
  values (tests.id('mine'), 'Backwards', now(), now() - interval '1 day')$$, 'promotions_dates_order');
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into public.promotions (business_id, title, starts_at, ends_at)
  values (tests.id('eve-biz'), 'Not mine', now(), now() + interval '1 day')$$, 'row-level security');
select tests.exec_as('authenticated', tests.id('owner'), $$
  insert into public.promotions (business_id, title, starts_at, ends_at)
  values (tests.id('mine'), '2x1 viernes', now() - interval '1 hour', now() + interval '3 days')$$);
update public.promotions set id = tests.id('promo') where title = '2x1 viernes';
select tests.exec_as('authenticated', tests.id('owner'),
  $$update public.promotions set ends_at = now(), is_active = false where id = tests.id('promo')$$);
select tests.expect_true('authenticated', tests.id('owner'),
  $$select count(*) = 1 from public.promotions where id = tests.id('promo') and not is_active$$,
  'owner still reads an ended promotion');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select count(*) = 0 from public.promotions where business_id = tests.id('eve-biz')$$,
  'owners do not read other businesses'' expired promotions');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.promotions set business_id = tests.id('eve-biz') where id = tests.id('promo')$$, 'permission denied');

rollback;
