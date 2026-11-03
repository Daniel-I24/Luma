-- -----------------------------------------------------------------------------
-- Admin MFA and audit log: is_admin needs aal2, admin_access, append-only
-- admin_audit_log, review_business logged. Roles: anon, customer (cus),
-- owner, admin (adm) with aal1 and aal2, service_role, postgres.
-- Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql
update public.businesses set verification_status = 'pending' where id = tests.id('v1');

-- -- aal1: an admin without MFA is not an admin ------------------------------------
select tests.use_aal('aal1');
select tests.expect_true('authenticated', tests.id('adm'),
  $$select not public.is_admin() and public.admin_access() = 'needs_mfa'$$, 'admin without MFA: needs_mfa');
select tests.expect_error('authenticated', tests.id('adm'), $$
  select public.review_business(tests.id('v1'), 'approved', null,
    (select updated_at from public.businesses where id = tests.id('v1')))$$, 'not_admin');
select tests.expect_error('authenticated', tests.id('adm'), $$select * from public.admin_open_reports()$$, 'not_admin');
select tests.expect_error('authenticated', tests.id('adm'), $$select * from public.admin_recent_audit(10)$$, 'not_admin');
select tests.expect_true('authenticated', tests.id('adm'),
  $$select count(*) = 0 from public.business_legal$$, 'aal1 admin reads no private legal data');
select tests.use_aal('aal2');

-- -- aal2 -------------------------------------------------------------------------------
select tests.expect_true('authenticated', tests.id('adm'),
  $$select public.is_admin() and public.admin_access() = 'ok'$$, 'admin with MFA: ok');
select tests.expect_true('authenticated', tests.id('cus'),
  $$select not public.is_admin() and public.admin_access() = 'none'$$, 'customer: none, even with aal2');
select tests.expect_error('authenticated', tests.id('cus'), $$select * from public.admin_recent_audit(10)$$, 'not_admin');
select tests.expect_error('anon', null, $$select public.admin_access()$$, 'permission denied');
select tests.expect_error('anon', null, $$select * from public.admin_recent_audit(10)$$, 'permission denied');

select tests.exec_as('authenticated', tests.id('adm'), $$
  select public.review_business(tests.id('v1'), 'approved', null,
    (select updated_at from public.businesses where id = tests.id('v1')))$$);
select tests.expect_true('authenticated', tests.id('adm'), $$
  select count(*) = 1 and bool_and(actor_id = tests.id('adm') and action = 'review_business'
         and target_id = tests.id('v1') and detail = 'approved')
  from public.admin_recent_audit(10)$$,
  'each decision is logged: who, action, target, when');

-- -- append only --------------------------------------------------------------------------
select tests.expect_error('authenticated', tests.id('adm'), $$select * from public.admin_audit_log$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('adm'),
  $$insert into public.admin_audit_log (actor_id, action, target_type) values (tests.id('adm'), 'void_payment', 'system')$$,
  'permission denied');
select tests.expect_error('authenticated', tests.id('adm'),
  $$select public.log_admin_action('void_payment', 'system', null)$$, 'permission denied');
select tests.expect_error('service_role', null, $$select * from public.admin_audit_log$$, 'permission denied');
select tests.expect_error('postgres', null, $$update public.admin_audit_log set detail = 'rejected'$$, 'audit_log_append_only');
select tests.expect_error('postgres', null, $$delete from public.admin_audit_log$$, 'audit_log_append_only');
select tests.expect_error('postgres', null, $$truncate public.admin_audit_log$$, 'audit_log_append_only');
select tests.expect_error('postgres', null,
  $$insert into public.admin_audit_log (actor_id, action, target_type, detail) values (tests.id('adm'), 'void_payment', 'system', 'Juan Perez 300')$$,
  'admin_audit_log_detail_shape');

rollback;
