-- -----------------------------------------------------------------------------
-- Round 9 (20261106000000_round9.sql): approving a business publishes it when
-- it can, every visibility state seen through the API roles, and the daily
-- creation guard of 10. Roles: owner, cus (customer), adm (admin, aal2),
-- anon, o9 (a new owner). Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql
select tests.use_aal('aal2');

-- Two businesses in review, never published by their owner (an API insert
-- always starts hidden): r1 is ready (open day and available product), r2
-- has no available product yet.
insert into public.businesses (id, owner_id, name, category, latitude, longitude, address, is_active) values
  (tests.id('r1'), tests.id('owner'), 'Listo Para Ver', 'Bar', 1.21, -77.28, 'Calle 2 # 2-2', false),
  (tests.id('r2'), tests.id('owner'), 'Sin Productos', 'Bar', 1.21, -77.28, 'Calle 3 # 3-3', false);
insert into public.business_hours (business_id, day_of_week, opens_at, closes_at)
select b, d, '00:00', '23:59:59.999999' from unnest(array[tests.id('r1'), tests.id('r2')]) b, generate_series(0, 6) d;
insert into public.menu_items (id, business_id, name, price_cop, is_available) values
  (tests.id('mr1'), tests.id('r1'), 'Empanada', 2500, true),
  (tests.id('mr2'), tests.id('r2'), 'Agotado', 2500, false);
update public.businesses set verification_status = 'pending' where id in (tests.id('r1'), tests.id('r2'));

create function tests.review(p_business text, p_decision text, p_note text default null) returns text language sql as $$
  select format('select public.review_business(%L, %L, %L, (select updated_at from public.businesses where id = %L))',
    tests.id(p_business), p_decision, p_note, tests.id(p_business)) $$;
create function tests.seen(p_business text) returns text language sql as $$
  select format('select exists (select 1 from public.businesses where id = %L)', tests.id(p_business)) $$;
grant execute on function tests.review(text, text, text), tests.seen(text) to anon, authenticated;

-- 1. Pending and hidden: nobody outside sees it -----------------------------------------------
select tests.expect_true('anon', null, 'select not (' || tests.seen('r1') || ')', 'a pending business that was never published is hidden from anon');

-- 2. Approving a ready business publishes it ------------------------------------------------
select tests.exec_as('authenticated', tests.id('adm'), tests.review('r1', 'approved'));
select tests.expect_true('postgres', null, $$
  select is_active from public.businesses where id = tests.id('r1')$$, 'approved with an open day and a product: published');
select tests.expect_true('anon', null, tests.seen('r1'), 'anon sees it right after the approval');
select tests.expect_true('authenticated', tests.id('cus'), tests.seen('r1'), 'a customer sees it too');
select tests.expect_true('anon', null, $$
  select count(*) = 1 from public.menu_items where business_id = tests.id('r1')$$, 'its menu is public');

-- 3. Approving a business without an available product keeps it hidden -----------------------
select tests.exec_as('authenticated', tests.id('adm'), tests.review('r2', 'approved'));
select tests.expect_true('postgres', null, $$
  select verification_status = 'approved' and not is_active from public.businesses where id = tests.id('r2')$$,
  'approved without a product: approved but still hidden');
select tests.expect_true('anon', null, 'select not (' || tests.seen('r2') || ')', 'anon does not see it');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set is_active = true where id = tests.id('r2')$$, 'publish_requirements_missing');
select tests.exec_as('authenticated', tests.id('owner'),
  $$update public.menu_items set is_available = true where id = tests.id('mr2')$$);
select tests.exec_as('authenticated', tests.id('owner'),
  $$update public.businesses set is_active = true where id = tests.id('r2')$$);
select tests.expect_true('anon', null, tests.seen('r2'), '"Publicar ahora" once the product is available: public');

-- 4. The owner can pause; a re-approval after a suspension keeps the pause -------------------
select tests.exec_as('authenticated', tests.id('owner'),
  $$update public.businesses set is_active = false where id = tests.id('r1')$$);
select tests.expect_true('anon', null, 'select not (' || tests.seen('r1') || ')', 'a paused business is hidden');
select tests.exec_as('authenticated', tests.id('adm'), tests.review('r1', 'suspended', 'Revisión de datos'));
select tests.exec_as('authenticated', tests.id('adm'), tests.review('r1', 'approved'));
select tests.expect_true('postgres', null, $$
  select verification_status = 'approved' and not is_active from public.businesses where id = tests.id('r1')$$,
  'approved again after a suspension: the owner''s pause stays');

-- 5. Pending and published, with show_pending_businesses -------------------------------------
update public.businesses set verification_status = 'pending', is_active = true where id = tests.id('r2');
select tests.expect_true('anon', null, 'select not (' || tests.seen('r2') || ')', 'setting 0: a published business in review is hidden');
update public.app_settings set int_value = 1 where key = 'show_pending_businesses';
select tests.expect_true('anon', null, tests.seen('r2'), 'setting 1: a published business in review is public (with its badge in the app)');
select tests.expect_true('authenticated', tests.id('cus'), $$
  select verification_status = 'pending' from public.businesses where id = tests.id('r2')$$,
  'the app reads its status to show the "En verificación" badge');
update public.businesses set is_active = false where id = tests.id('r2');
select tests.expect_true('anon', null, 'select not (' || tests.seen('r2') || ')', 'setting 1: an unpublished business in review stays hidden');
update public.app_settings set int_value = 0 where key = 'show_pending_businesses';

-- 6. Only an admin approves ------------------------------------------------------------------
select tests.expect_error('authenticated', tests.id('owner'), tests.review('r2', 'approved'), 'not_admin');

-- 7. Daily creation guard: 10, not a visible rule ---------------------------------------------
select tests.expect_true('postgres', null, $$
  select int_value = 10 from public.app_settings where key = 'rate_business_create_max'$$, 'the internal guard is 10 a day');
insert into auth.users (id, email) values (tests.id('o9'), 'o9@test.local');
select tests.complete_profile('o9');
update public.profiles set account_type = 'business_owner' where id = tests.id('o9');
select tests.exec_as('authenticated', tests.id('o9'), $$
  do $do$ begin
    for i in 1..10 loop
      insert into public.businesses (owner_id, name, category, latitude, longitude, address)
      values (tests.id('o9'), 'Negocio ' || i, 'Bar', 1.21, -77.28, 'Calle 1 # 1-1');
      delete from public.businesses where owner_id = tests.id('o9');
    end loop;
  end $do$ $$);
select tests.expect_error('authenticated', tests.id('o9'), $$
  insert into public.businesses (owner_id, name, category, latitude, longitude, address)
  values (tests.id('o9'), 'Negocio once', 'Bar', 1.21, -77.28, 'Calle 1 # 1-1')$$, 'business_daily_limit');

rollback;
