-- -----------------------------------------------------------------------------
-- Round 6 (20261103000000_round6.sql): automatic contact verification.
-- WhatsApp inbound (phone and WhatsApp), website file, the strategy per kind
-- and Instagram/Facebook still in the admin queue.
-- Roles: owner (pub approved), eve (another owner), cus, adm (aal2) and
-- service_role (the Edge Functions). Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql
select tests.use_aal('aal2');

update public.businesses set phone = '+573001112233', whatsapp = '+573004445566', instagram = 'cafe.publico',
  website = 'https://cafe.example.co' where id = tests.id('pub');
create table tests.codes (kind text, code text);
grant all on tests.codes to authenticated, service_role;
select tests.exec_as('authenticated', tests.id('owner'), $$
  insert into tests.codes select k, public.request_contact_verification(tests.id('pub'), k)
  from unnest(array['phone', 'whatsapp', 'instagram']) k$$);
create function tests.code(p_kind text) returns text language sql stable as $$ select code from tests.codes where kind = p_kind $$;
create function tests.hash(p text) returns text language sql immutable as $$ select md5(p) || md5(p || 'x') $$;
grant execute on function tests.code(text), tests.hash(text) to authenticated, service_role;
create function tests.wa(p_id text, p_from text, p_code text) returns text language sql as $$
  select public.verify_contact_from_whatsapp(p_id, tests.hash(p_from), p_from, p_code) $$;
grant execute on function tests.wa(text, text, text) to service_role, authenticated;
create table tests.out (outcome text);
grant all on tests.out to service_role;

-- 1. Strategy per kind, everything off by default -------------------------------------
select tests.expect_true('authenticated', tests.id('owner'),
  $$select bool_and(strategy = 'manual') and count(*) = 5 from public.contact_verifier_config()$$,
  'with the flags off every kind uses the admin queue');
select tests.exec_as('service_role', null, $$insert into tests.out select tests.wa('m0', '573001112233', tests.code('phone'))$$);
select tests.expect_true('postgres', null, $$select outcome = 'disabled' from tests.out$$,
  'the webhook does nothing while contact_auto_whatsapp is off');
delete from tests.out;
update public.app_settings set int_value = 1 where key in ('contact_auto_whatsapp', 'contact_auto_website');
select tests.expect_true('authenticated', tests.id('owner'), $$
  select array_agg(kind || ':' || strategy order by kind) =
         array['facebook:manual', 'instagram:manual', 'phone:whatsapp', 'website:website', 'whatsapp:whatsapp']
  from public.contact_verifier_config()$$,
  'flags on: phone and WhatsApp by WhatsApp, website by file, Instagram and Facebook manual');

-- 2. Only service_role calls the automatic functions ------------------------------------
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.verify_contact_from_whatsapp('m1', tests.hash('x'), '573001112233', 'LUMA-AAAAAA')$$, 'permission denied');
select tests.expect_error('anon', null,
  $$select public.verify_contact_from_whatsapp('m1', tests.hash('x'), '573001112233', 'LUMA-AAAAAA')$$, 'permission denied');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.complete_website_check(gen_random_uuid())$$, 'permission denied');

-- 3. WhatsApp inbound --------------------------------------------------------------------
select tests.exec_as('service_role', null, $$insert into tests.out select tests.wa('m2', '573009999999', tests.code('phone'))$$);
select tests.expect_true('postgres', null, $$
  select (select outcome from tests.out) = 'no_match'
     and (select phone_verified_at is null from public.businesses where id = tests.id('pub'))$$,
  'a code sent from another number verifies nothing');
delete from tests.out;
select tests.exec_as('service_role', null, $$insert into tests.out select tests.wa('m3', '573001112233', 'LUMA-ZZZZZZ')$$);
select tests.expect_true('postgres', null, $$select outcome = 'no_match' from tests.out$$, 'an unknown code verifies nothing');
delete from tests.out;
select tests.exec_as('service_role', null, $$insert into tests.out select tests.wa('m4', '573001112233', tests.code('whatsapp'))$$);
select tests.expect_true('postgres', null, $$select outcome = 'no_match' from tests.out$$,
  'the code of another contact (someone else''s code) verifies nothing');
delete from tests.out;
select tests.exec_as('service_role', null, $$insert into tests.out select tests.wa('m5', '573001112233', tests.code('instagram'))$$);
select tests.expect_true('postgres', null, $$select outcome = 'no_match' from tests.out$$,
  'an Instagram code never goes through WhatsApp');
delete from tests.out;
select tests.exec_as('service_role', null, $$insert into tests.out select tests.wa('m6', '573001112233', tests.code('phone'))$$);
select tests.expect_true('postgres', null, $$
  select (select outcome from tests.out) = 'verified'
     and (select phone_verified_at is not null from public.businesses where id = tests.id('pub'))
     and exists (select 1 from public.notifications n where n.user_id = tests.id('owner')
                 and n.type = 'contact_verification' and n.status = 'approved')$$,
  'the code from the business''s own number verifies the phone and tells the owner');
delete from tests.out;
select tests.exec_as('service_role', null, $$insert into tests.out select tests.wa('m6', '573001112233', tests.code('phone'))$$);
select tests.expect_true('postgres', null, $$select outcome = 'duplicate' from tests.out$$,
  'the same message id twice is processed once');
delete from tests.out;
select tests.expect_true('postgres', null, $$
  select not exists (select 1 from private.whatsapp_sender_attempts where sender_hash like '%573%')
     and (select count(*) from private.whatsapp_messages) >= 5$$,
  'only message ids and a hash of the sender are kept, never the number');
update public.contact_verifications set requested_at = now() - interval '25 hours' where kind = 'whatsapp';
select tests.exec_as('service_role', null, $$insert into tests.out select tests.wa('m7', '573004445566', tests.code('whatsapp'))$$);
select tests.expect_true('postgres', null, $$
  select (select outcome from tests.out) = 'expired'
     and (select whatsapp_verified_at is null from public.businesses where id = tests.id('pub'))$$,
  'a code older than 24 hours has expired');
delete from tests.out;
update public.app_settings set int_value = 2 where key = 'whatsapp_sender_max_daily';
select tests.exec_as('service_role', null, $$insert into tests.out select tests.wa('m8', '573004445566', 'LUMA-QQQQQQ')$$);
select tests.exec_as('service_role', null, $$insert into tests.out select tests.wa('m9', '573004445566', 'LUMA-QQQQQQ')$$);
select tests.expect_true('postgres', null, $$select bool_or(outcome = 'limited') from tests.out$$,
  'a sender that tries too many codes in a day is stopped');
delete from tests.out;

-- 4. Website file --------------------------------------------------------------------------
select tests.exec_as('authenticated', tests.id('owner'),
  $$insert into tests.codes select 'website', public.request_contact_verification(tests.id('pub'), 'website')$$);
create table tests.checks as select null::uuid as id, null::text as website, null::text as code limit 0;
grant all on tests.checks to authenticated;
select tests.expect_error('authenticated', tests.id('eve'),
  $$select * from public.start_website_check(tests.id('pub'))$$, 'not_owner');
select tests.exec_as('authenticated', tests.id('owner'),
  $$insert into tests.checks select * from public.start_website_check(tests.id('pub'))$$);
select tests.expect_true('postgres', null, $$
  select website = 'https://cafe.example.co' and code = tests.code('website') from tests.checks$$,
  'the owner gets the website and the code to look for');
select tests.exec_as('authenticated', tests.id('owner'), $$select * from public.start_website_check(tests.id('pub'))$$);
select tests.exec_as('authenticated', tests.id('owner'), $$select * from public.start_website_check(tests.id('pub'))$$);
select tests.expect_error('authenticated', tests.id('owner'),
  $$select * from public.start_website_check(tests.id('pub'))$$, 'too_many_checks');
create table tests.done (ok boolean);
grant all on tests.done to service_role;
grant select on tests.checks to service_role;
select tests.exec_as('service_role', null, $$insert into tests.done select public.complete_website_check((select id from tests.checks))$$);
select tests.expect_true('postgres', null, $$
  select (select ok from tests.done) and (select website_verified_at is not null from public.businesses where id = tests.id('pub'))$$,
  'a matching file verifies the website');

-- 5. Instagram and Facebook still go through the admin queue ----------------------------
select tests.expect_true('authenticated', tests.id('adm'), $$
  select exists (select 1 from public.admin_pending_contact_verifications() where kind = 'instagram')$$,
  'with the automatic strategies on, Instagram is still in the admin queue');
create table tests.ig as select id from public.contact_verifications where kind = 'instagram';
grant select on tests.ig to authenticated;
select tests.exec_as('authenticated', tests.id('adm'), $$select public.admin_verify_contact((select id from tests.ig), 'verified')$$);
select tests.expect_true('postgres', null,
  $$select instagram_verified_at is not null from public.businesses where id = tests.id('pub')$$,
  'the admin verifies Instagram as before');
update public.app_settings set int_value = 0 where key = 'contact_auto_website';
select tests.expect_error('authenticated', tests.id('owner'),
  $$select * from public.start_website_check(tests.id('pub'))$$, 'auto_disabled');

rollback;
