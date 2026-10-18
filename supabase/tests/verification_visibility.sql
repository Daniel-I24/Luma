-- -----------------------------------------------------------------------------
-- Verification: what anon, customers, owners and admins see; who writes the
-- verification fields; reports. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql

-- -- a business that is not approved is invisible to the public ----------------
select tests.expect_true('anon', null,
  $$select count(*) = 1 from public.businesses where id in (tests.id('v1'), tests.id('pub'))$$,
  'anon sees only the approved business');
select tests.expect_true('authenticated', tests.id('cus'),
  $$select (select count(*) from public.businesses where id = tests.id('v1')) = 0
       and (select count(*) from public.business_hours where business_id = tests.id('v1')) = 0
       and (select count(*) from public.menu_items where business_id = tests.id('v1')) = 0$$,
  'a customer sees neither the business nor its hours or menu');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select count(*) = 2 from public.businesses where owner_id = tests.id('owner')$$,
  'the owner sees their businesses in any state');
select tests.expect_true('authenticated', tests.id('adm'),
  $$select (select count(*) from public.businesses where id = tests.id('v1')) = 1
       and (select count(*) from public.menu_items where business_id = tests.id('v1')) = 1$$,
  'an admin reads businesses under review');
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.create_order(tests.id('v1'), jsonb_build_array(tests.line_of('mv1', 1)))$$,
  'business_unavailable');

-- -- nobody but the server writes verification_* --------------------------------
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set verification_status = 'approved' where id = tests.id('v1')$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set verified_at = now() where id = tests.id('v1')$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('owner'),
  $$insert into public.businesses (owner_id, name, category, latitude, longitude, address, verification_status)
    values (tests.id('owner'), 'Sneaky', 'Bar', 1, 1, 'Calle 1 # 1-1', 'approved')$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('cus'),
  $$insert into public.businesses (owner_id, name, category, latitude, longitude, address)
    values (tests.id('cus'), 'Mine', 'Bar', 1, 1, 'Calle 1 # 1-1')$$, 'not_business_owner');

-- -- admins ----------------------------------------------------------------------
select tests.expect_true('authenticated', tests.id('adm'), $$select public.am_i_admin()$$, 'admin is admin');
select tests.expect_true('authenticated', tests.id('cus'), $$select not public.am_i_admin()$$, 'customer is not');
select tests.expect_error('anon', null, $$select public.am_i_admin()$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('cus'), $$select * from public.admins$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('cus'),
  $$insert into public.admins (user_id) values (tests.id('cus'))$$, 'permission denied');

-- -- reports -----------------------------------------------------------------------
select tests.exec_as('authenticated', tests.id('cus'), $$
  insert into public.reports (business_id, reason, comment) values (tests.id('pub'), 'false_info', 'No existe')$$);
select tests.expect_error('authenticated', tests.id('cus'), $$
  insert into public.reports (business_id, reason) values (tests.id('pub'), 'other')$$, 'reports_one_open_idx');
select tests.expect_error('authenticated', tests.id('cus'), $$
  insert into public.reports (business_id, reason) values (tests.id('v1'), 'other')$$, 'row-level security');
select tests.expect_error('authenticated', tests.id('cus'), $$
  insert into public.reports (reporter, business_id, reason) values (tests.id('eve'), tests.id('pub'), 'other')$$,
  'permission denied');
select tests.expect_true('authenticated', tests.id('eve'),
  $$select count(*) = 0 from public.reports$$, 'users only read their own reports');
select tests.expect_error('authenticated', tests.id('cus'), $$select * from public.admin_open_reports()$$, 'not_admin');
select tests.expect_true('authenticated', tests.id('adm'),
  $$select count(*) = 1 and bool_and(business_name = 'Café Público') from public.admin_open_reports()$$,
  'admins list open reports');
select tests.expect_true('authenticated', tests.id('adm'),
  $$select count(*) = 0 from information_schema.routines r
    join information_schema.parameters p on p.specific_name = r.specific_name
    where r.routine_name = 'admin_open_reports' and p.parameter_name = 'reporter'$$,
  'the report list never returns the reporter');
select tests.exec_as('authenticated', tests.id('adm'), $$
  select public.resolve_report((select id from public.admin_open_reports() limit 1), 'reviewed')$$);
select tests.expect_true('authenticated', tests.id('adm'),
  $$select count(*) = 0 from public.admin_open_reports()$$, 'a resolved report leaves the queue');

rollback;
