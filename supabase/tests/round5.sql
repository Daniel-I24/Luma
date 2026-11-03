-- -----------------------------------------------------------------------------
-- Round 5 (20261102000000_round5.sql): own_business in create_order,
-- verifiable contacts, the public trust summary, the legal data correction
-- of an approved business and the test push.
-- Roles: owner (owns v1 draft and pub approved), eve (another owner), cus
-- (customer), adm (admin; aal1 and aal2). Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql
select tests.use_aal('aal2');

-- 1. Nobody orders from their own business -------------------------------------------
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.create_order(tests.id('pub'), jsonb_build_array(tests.line_of('mpub', 1)))$$, 'own_business');
select tests.exec_as('authenticated', tests.id('cus'),
  $$select public.create_order(tests.id('pub'), jsonb_build_array(tests.line_of('mpub', 1)))$$);
select tests.expect_true('postgres', null, $$
  select count(*) = 1 from public.orders where business_id = tests.id('pub') and user_id = tests.id('cus')$$,
  'a customer still orders; the owner of the business never does');

-- 2. Verifiable contacts -------------------------------------------------------------
update public.businesses set whatsapp = '+573001112233', instagram = 'cafe.publico' where id = tests.id('pub');
create table tests.codes (code text);
grant all on tests.codes to authenticated;
select tests.exec_as('authenticated', tests.id('owner'),
  $$insert into tests.codes select public.request_contact_verification(tests.id('pub'), 'whatsapp')$$);
select tests.expect_true('postgres', null, $$select bool_and(code ~ '^LUMA-[A-Z0-9]{6}$') and count(*) = 1 from tests.codes$$,
  'the owner gets a LUMA-XXXXXX code for a contact of their business');
select tests.expect_error('authenticated', tests.id('eve'),
  $$select public.request_contact_verification(tests.id('pub'), 'whatsapp')$$, 'not_owner');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.request_contact_verification(tests.id('pub'), 'email')$$, 'invalid_contact_kind');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.request_contact_verification(tests.id('pub'), 'phone')$$, 'contact_missing');
-- Three a day per kind and business (round 7: per kind, not in total).
select tests.exec_as('authenticated', tests.id('owner'), $$select public.request_contact_verification(tests.id('pub'), 'instagram')$$);
select tests.exec_as('authenticated', tests.id('owner'), $$select public.request_contact_verification(tests.id('pub'), 'instagram')$$);
select tests.exec_as('authenticated', tests.id('owner'), $$select public.request_contact_verification(tests.id('pub'), 'instagram')$$);
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.request_contact_verification(tests.id('pub'), 'instagram')$$, 'too_many_requests');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set whatsapp_verified_at = now() where id = tests.id('pub')$$, 'permission denied');
select tests.expect_true('authenticated', tests.id('cus'),
  $$select count(*) = 0 from public.contact_verifications$$, 'customers never read the codes');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select count(*) = 4 from public.contact_verifications where business_id = tests.id('pub')$$,
  'the owner reads the requests of their business with their steps');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select * from public.admin_pending_contact_verifications()$$, 'not_admin');
-- The admin reads ids from the queue; the checks below take them from here.
create table tests.requests as select id, kind from public.contact_verifications;
grant select on tests.requests to authenticated;
select tests.use_aal('aal1');
select tests.expect_error('authenticated', tests.id('adm'),
  $$select public.admin_verify_contact((select id from tests.requests where kind = 'whatsapp'), 'verified')$$,
  'not_admin');
select tests.use_aal('aal2');
select tests.expect_true('authenticated', tests.id('adm'), $$
  select count(*) = 2 and bool_and(code ~ '^LUMA-' and value is not null and business_name = 'Café Público')
  from public.admin_pending_contact_verifications()$$,
  'the admin queue shows value, code and business (one pending request per kind since round 7)');
select tests.exec_as('authenticated', tests.id('adm'),
  $$select public.admin_verify_contact((select id from tests.requests where kind = 'whatsapp'), 'verified')$$);
select tests.expect_true('postgres', null, $$
  select b.whatsapp_verified_at is not null and b.instagram_verified_at is null
     and exists (select 1 from public.notifications n where n.user_id = tests.id('owner')
                 and n.type = 'contact_verification' and n.business_id = b.id and n.status = 'approved')
     and exists (select 1 from public.admin_audit_log a where a.action = 'verify_contact' and a.detail = 'whatsapp')
  from public.businesses b where b.id = tests.id('pub')$$,
  'verifying sets only that contact, tells the owner and is audited');
select tests.expect_error('authenticated', tests.id('adm'),
  $$select public.admin_verify_contact((select id from tests.requests where kind = 'whatsapp'), 'verified')$$,
  'verification_not_pending');
update public.businesses set instagram = 'cafe.publico.co' where id = tests.id('pub');
select tests.expect_true('postgres', null, $$
  select (select count(*) from public.contact_verifications where kind = 'instagram' and status = 'rejected') = 3$$,
  'changing a value voids its pending requests');
update public.businesses set whatsapp = '+573009998877' where id = tests.id('pub');
select tests.expect_true('postgres', null,
  $$select whatsapp_verified_at is null from public.businesses where id = tests.id('pub')$$,
  'a changed contact is not verified any more');

-- 3. Public trust summary ------------------------------------------------------------
update public.businesses set whatsapp = '+573001112233' where id = tests.id('pub');
update public.businesses set whatsapp_verified_at = now(), verified_at = now() - interval '3 months' where id = tests.id('pub');
select tests.expect_true('authenticated', tests.id('cus'), $$
  select verified_since is not null and verified_contacts = array['whatsapp'] and completed_orders = '0'
     and months_on_luma >= 0
  from public.business_trust_summary(tests.id('pub'))$$,
  'a customer sees verified since, verified contacts and completed orders as a range');
select tests.expect_true('postgres', null, $$
  select pg_get_function_result('public.business_trust_summary(uuid)'::regprocedure) !~* '(tax|legal|nit|doc|phone text|email|owner)'$$,
  'the summary never carries NIT, legal name, documents or personal data');
select tests.expect_error('anon', null, $$select * from public.business_trust_summary(tests.id('pub'))$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('cus'),
  $$select * from public.business_trust_summary(tests.id('v1'))$$, 'business_unavailable');

-- 4. Legal data correction of an approved business ----------------------------------
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.request_legal_correction(tests.id('v1'))$$, 'invalid_transition');
select tests.expect_error('authenticated', tests.id('eve'),
  $$select public.request_legal_correction(tests.id('pub'))$$, 'not_owner');
select tests.exec_as('authenticated', tests.id('owner'), $$select public.request_legal_correction(tests.id('pub'))$$);
select tests.expect_true('authenticated', tests.id('owner'), $$
  select b.verification_status = 'rejected' and b.verification_note = 'owner_correction'
     and not public.is_business_public(b.id) and public.owns_editable_business(b.id)
  from public.businesses b where b.id = tests.id('pub')$$,
  'it stops being public and the legal data can be edited until a new review');

-- 5. Test push -----------------------------------------------------------------------
select tests.exec_as('authenticated', tests.id('cus'), $$select public.send_test_notification()$$);
select tests.exec_as('authenticated', tests.id('cus'), $$select public.send_test_notification()$$);
select tests.exec_as('authenticated', tests.id('cus'), $$select public.send_test_notification()$$);
select tests.expect_error('authenticated', tests.id('cus'), $$select public.send_test_notification()$$, 'rate_limited');
select tests.expect_true('postgres', null, $$
  select count(*) = 3 from public.notifications where user_id = tests.id('cus') and type = 'test'$$,
  'at most 3 test notifications a day');
select tests.expect_error('anon', null, $$select public.send_test_notification()$$, 'permission denied');

rollback;
