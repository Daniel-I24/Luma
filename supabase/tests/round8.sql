-- -----------------------------------------------------------------------------
-- Round 8 (20261105000000_round8.sql): the test notification for admins only
-- and the visibility of businesses in review (show_pending_businesses).
-- Roles: owner (v1 draft, pub approved), cus (customer), adm (admin, aal2),
-- anon. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql
select tests.use_aal('aal2');

-- 1. Test notification ---------------------------------------------------------------------
select tests.expect_error('authenticated', tests.id('cus'), $$select public.send_test_notification()$$, 'not_admin');
select tests.expect_error('authenticated', tests.id('owner'), $$select public.send_test_notification()$$, 'not_admin');
select tests.exec_as('authenticated', tests.id('adm'), $$select public.send_test_notification()$$);
select tests.expect_true('postgres', null, $$
  select count(*) = 1 from public.notifications where user_id = tests.id('adm') and type = 'test'$$,
  'an admin (aal2) tests their own device');
select tests.use_aal('aal1');
select tests.expect_error('authenticated', tests.id('adm'), $$select public.send_test_notification()$$, 'not_admin');
select tests.use_aal('aal2');

-- 2. Visibility per status -------------------------------------------------------------------
insert into public.businesses (id, owner_id, name, category, latitude, longitude, address, is_active) values
  (tests.id('s-pending'), tests.id('owner'), 'Pendiente', 'Bar', 1.21, -77.28, 'Calle 1 # 1-1', true),
  (tests.id('s-rejected'), tests.id('owner'), 'Rechazado', 'Bar', 1.21, -77.28, 'Calle 1 # 1-1', true),
  (tests.id('s-suspended'), tests.id('owner'), 'Suspendido', 'Bar', 1.21, -77.28, 'Calle 1 # 1-1', true);
update public.businesses set verification_status = 'pending' where id = tests.id('s-pending');
update public.businesses set verification_status = 'rejected' where id = tests.id('s-rejected');
update public.businesses set verification_status = 'suspended' where id = tests.id('s-suspended');
create function tests.visible() returns text[] language sql stable as $$
  select coalesce(array_agg(name order by name), '{}') from public.businesses
  where id in (tests.id('v1'), tests.id('pub'), tests.id('s-pending'), tests.id('s-rejected'), tests.id('s-suspended')) $$;
grant execute on function tests.visible() to anon, authenticated;

select tests.expect_true('anon', null, $$select tests.visible() = array['Café Público']$$,
  'setting 0: only approved; draft, pending, rejected and suspended are hidden');
select tests.expect_true('authenticated', tests.id('cus'), $$select tests.visible() = array['Café Público']$$,
  'the same for a signed-in customer');
update public.app_settings set int_value = 1 where key = 'show_pending_businesses';
select tests.expect_true('anon', null, $$select tests.visible() = array['Café Público', 'Pendiente']$$,
  'setting 1: a business in review shows too; a draft (v1) never does');
update public.businesses set verification_status = 'rejected' where id = tests.id('s-pending');
select tests.expect_true('anon', null, $$select tests.visible() = array['Café Público']$$,
  'a rejected business disappears again');
update public.businesses set verification_status = 'draft' where id = tests.id('pub');
select tests.expect_true('anon', null, $$select tests.visible() = '{}'$$,
  'a business back to draft is never public');
update public.businesses set verification_status = 'approved' where id = tests.id('pub');

-- 3. A business in review: pick-up payment only -----------------------------------------------
update public.businesses set verification_status = 'pending' where id = tests.id('v1');
update public.app_settings set int_value = 1 where key = 'payments_enabled';
select tests.expect_true('authenticated', tests.id('cus'), $$
  select count(*) = 1 from public.menu_items where business_id = tests.id('v1')$$,
  'its menu is public while it is in review (setting 1)');
select tests.exec_as('authenticated', tests.id('cus'),
  $$select public.create_order(tests.id('v1'), jsonb_build_array(tests.line_of('mv1', 1)))$$);
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.create_order(tests.id('v1'), jsonb_build_array(tests.line_of('mv1', 1)), null, null, 'online')$$,
  'online_payment_unavailable');
update public.app_settings set int_value = 0 where key = 'show_pending_businesses';
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.create_order(tests.id('v1'), jsonb_build_array(tests.line_of('mv1', 1)))$$, 'business_unavailable');

rollback;
