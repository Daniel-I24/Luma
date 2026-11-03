-- -----------------------------------------------------------------------------
-- extract-menu quota. Roles: anon, the owner of pub and v1, another owner
-- (eve), a customer (cus), an admin (adm). Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql

update public.app_settings set int_value = 2 where key = 'menu_scan_daily_per_business';
update public.app_settings set int_value = 3 where key = 'ai_daily_per_user';

select tests.expect_error('anon', null,
  $$select public.consume_menu_scan_quota(tests.id('pub'))$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('eve'),
  $$select public.consume_menu_scan_quota(tests.id('pub'))$$, 'not_business_owner');
select tests.expect_error('authenticated', tests.id('cus'),
  $$select public.consume_menu_scan_quota(tests.id('pub'))$$, 'not_business_owner');
select tests.expect_error('authenticated', tests.id('adm'),
  $$select public.consume_menu_scan_quota(tests.id('pub'))$$, 'not_business_owner');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.consume_menu_scan_quota(null)$$, 'not_business_owner');

select tests.expect_true('authenticated', tests.id('owner'), $$
  select public.consume_menu_scan_quota(tests.id('pub')) and public.consume_menu_scan_quota(tests.id('pub'))
     and not public.consume_menu_scan_quota(tests.id('pub'))$$,
  'a business gets its daily scans, then false');
select tests.expect_true('authenticated', tests.id('owner'), $$
  select public.consume_menu_scan_quota(tests.id('v1')) and not public.consume_menu_scan_quota(tests.id('v1'))$$,
  'scans count towards the owner''s daily AI limit too (draft businesses may scan)');
select tests.expect_true('postgres', null, $$
  select (select calls from public.ai_usage where scope = 'menu_scan' and subject = tests.id('pub')) = 2
     and (select calls from public.ai_usage where scope = 'user' and subject = tests.id('owner')) = 3$$,
  'refused scans are not counted');

update auth.users set email_confirmed_at = null where id = tests.id('owner');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.consume_menu_scan_quota(tests.id('pub'))$$, 'email_not_confirmed');

rollback;
