-- -----------------------------------------------------------------------------
-- Contact review (20261117000000_contact_review.sql): a request tells the
-- admins once while their notice is unread, a rejection needs a reason the
-- owner reads, and nobody else can ask, decide or write the reason.
-- Roles: owner (owns pub), eve (another owner), cus (customer), adm (admin).
-- Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql
select tests.use_aal('aal2');
update public.businesses set instagram = 'cafe.publico', website = 'https://cafe.example' where id = tests.id('pub');

-- 1. A request reaches the team -------------------------------------------------------------
select tests.exec_as('authenticated', tests.id('owner'), $$select public.request_contact_verification(tests.id('pub'), 'instagram')$$);
select tests.expect_true('postgres', null, $$
  select count(*) = 1 from public.notifications
  where user_id = tests.id('adm') and type = 'contact_verification' and status = 'contact_requested'
    and business_id = tests.id('pub')$$,
  'the admin is told when an owner asks to verify a contact');
select tests.expect_true('postgres', null, $$
  select count(*) = 0 from public.notifications
  where status = 'contact_requested' and user_id in (tests.id('owner'), tests.id('eve'), tests.id('cus'))$$,
  'nobody but the admins hears of a request');
select tests.exec_as('authenticated', tests.id('owner'), $$select public.request_contact_verification(tests.id('pub'), 'website')$$);
select tests.expect_true('postgres', null, $$
  select count(*) = 1 from public.notifications where user_id = tests.id('adm') and status = 'contact_requested'$$,
  'more requests while the notice is unread do not flood the admin');
update public.notifications set read_at = now() where user_id = tests.id('adm') and status = 'contact_requested';
select tests.exec_as('authenticated', tests.id('owner'), $$select public.request_contact_verification(tests.id('pub'), 'instagram')$$);
select tests.expect_true('postgres', null, $$
  select count(*) = 1 from public.notifications
  where user_id = tests.id('adm') and status = 'contact_requested' and read_at is null$$,
  'once read, a new request tells the admin again');
select tests.expect_true('authenticated', tests.id('adm'), $$
  select count(*) = 2 from public.admin_pending_contact_verifications() where business_id = tests.id('pub')$$,
  'the queue lists the pending Instagram and website requests');

-- 2. Abuse: asking for someone else, writing the reason -------------------------------------
select tests.expect_error('authenticated', tests.id('eve'),
  $$select public.request_contact_verification(tests.id('pub'), 'instagram')$$, 'not_owner');
select tests.expect_true('postgres', null, $$
  select count(*) = 1 from public.notifications where user_id = tests.id('adm') and status = 'contact_requested' and read_at is null$$,
  'a refused request tells nobody');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.contact_verifications set reject_reason = 'Lo apruebo yo', status = 'verified' where business_id = tests.id('pub')$$,
  'permission denied');
select tests.expect_error('authenticated', tests.id('owner'),
  $$insert into public.notifications (user_id, type, business_id, status)
    values (tests.id('adm'), 'contact_verification', tests.id('pub'), 'contact_requested')$$,
  'permission denied');
select tests.expect_error('anon', null,
  $$select public.admin_verify_contact(gen_random_uuid(), 'rejected', 'Sin código')$$, 'permission denied');

-- 3. Deciding: only an admin with aal2, and a rejection needs a reason ----------------------
create table tests.pending as
  select id, kind from public.contact_verifications where business_id = tests.id('pub') and status = 'pending';
grant select on tests.pending to authenticated;
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.admin_verify_contact((select id from tests.pending where kind = 'instagram'), 'verified')$$, 'not_admin');
select tests.use_aal('aal1');
select tests.expect_error('authenticated', tests.id('adm'),
  $$select public.admin_verify_contact((select id from tests.pending where kind = 'instagram'), 'rejected', 'Sin código')$$,
  'not_admin');
select tests.use_aal('aal2');
select tests.expect_error('authenticated', tests.id('adm'),
  $$select public.admin_verify_contact((select id from tests.pending where kind = 'instagram'), 'rejected')$$, 'reason_required');
select tests.expect_error('authenticated', tests.id('adm'),
  $$select public.admin_verify_contact((select id from tests.pending where kind = 'instagram'), 'rejected', E' \t​ ')$$,
  'reason_required');
select tests.expect_error('authenticated', tests.id('adm'),
  $$select public.admin_verify_contact((select id from tests.pending where kind = 'instagram'), 'rejected', 'No')$$,
  'reason_required');
select tests.expect_error('authenticated', tests.id('adm'),
  $$select public.admin_verify_contact((select id from tests.pending where kind = 'instagram'), 'rejected', repeat('a', 301))$$,
  'reason_required');
select tests.expect_true('postgres', null, $$
  select count(*) = 2 from public.contact_verifications where business_id = tests.id('pub') and status = 'pending'$$,
  'a refused decision changes nothing');
select tests.exec_as('authenticated', tests.id('adm'), $$
  select public.admin_verify_contact((select id from tests.pending where kind = 'instagram'), 'rejected',
                                     E'  No encontramos   el código​ en la biografía. ')$$);
select tests.expect_true('postgres', null, $$
  select v.status = 'rejected' and v.verified_at is not null
     and v.reject_reason = 'No encontramos el código en la biografía.'
     and exists (select 1 from public.notifications n where n.user_id = tests.id('owner')
                 and n.type = 'contact_verification' and n.business_id = tests.id('pub') and n.status = 'rejected')
     and exists (select 1 from public.admin_audit_log a where a.action = 'verify_contact' and a.detail = 'instagram')
  from public.contact_verifications v where v.id = (select id from tests.pending where kind = 'instagram')$$,
  'a rejection keeps the cleaned reason, tells the owner and is audited');
select tests.expect_true('authenticated', tests.id('owner'), $$
  select reject_reason = 'No encontramos el código en la biografía.' and verified_at is not null
  from public.contact_verifications where id = (select id from tests.pending where kind = 'instagram')$$,
  'the owner reads why it was rejected');
select tests.expect_true('authenticated', tests.id('eve'),
  $$select count(*) = 0 from public.contact_verifications where business_id = tests.id('pub')$$,
  'another owner reads neither the requests nor the reasons');
select tests.expect_error('authenticated', tests.id('adm'),
  $$select public.admin_verify_contact((select id from tests.pending where kind = 'instagram'), 'verified')$$,
  'verification_not_pending');

-- 4. Verifying needs no reason; replaced requests carry no decision -------------------------
select tests.exec_as('authenticated', tests.id('adm'),
  $$select public.admin_verify_contact((select id from tests.pending where kind = 'website'), 'verified')$$);
select tests.expect_true('postgres', null, $$
  select v.status = 'verified' and v.reject_reason is null and b.website_verified_at is not null
  from public.contact_verifications v join public.businesses b on b.id = v.business_id
  where v.id = (select id from tests.pending where kind = 'website')$$,
  'verifying without a reason still works');
select tests.expect_true('postgres', null, $$
  select count(*) = 1 from public.contact_verifications
  where business_id = tests.id('pub') and kind = 'instagram' and status = 'rejected' and verified_at is null$$,
  'the request replaced by a newer one is not a decision of the team');
select tests.expect_error('postgres', null,
  $$update public.contact_verifications set reject_reason = 'Motivo suelto' where status = 'verified'$$,
  'contact_verifications_reject_reason_shape');

select tests.restore();
rollback;
