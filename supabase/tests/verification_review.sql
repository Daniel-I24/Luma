-- -----------------------------------------------------------------------------
-- Review rules: frozen identity while pending, stale reviews, suspension and
-- reactivation. Roles: owner, another owner (eve), customer, admin, anon.
-- Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql

-- v1 under review.
update public.businesses set verification_status = 'pending' where id = tests.id('v1');
create function tests.seen(p_name text) returns timestamptz language sql stable
as $$ select updated_at from public.businesses where id = tests.id(p_name) $$;
grant execute on function tests.seen(text) to authenticated;

-- -- while pending, the owner cannot change what is being reviewed -------------------
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set name = 'Otro nombre' where id = tests.id('v1')$$, 'business_under_review');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set latitude = 1.3 where id = tests.id('v1')$$, 'business_under_review');
select tests.exec_as('authenticated', tests.id('owner'),
  $$update public.businesses set description = 'Carta nueva' where id = tests.id('v1')$$);
select tests.expect_true('authenticated', tests.id('owner'),
  $$select description = 'Carta nueva' and name = 'Fritanga Nueva' from public.businesses where id = tests.id('v1')$$,
  'other fields stay editable while pending');

-- -- stale reviews ----------------------------------------------------------------------
select tests.expect_error('authenticated', tests.id('adm'),
  $$select public.review_business(tests.id('v1'), 'approved', null, now() - interval '1 day')$$, 'stale_review');
select tests.expect_true('authenticated', tests.id('adm'),
  $$select verification_status = 'pending' from public.businesses where id = tests.id('v1')$$,
  'a stale decision changes nothing');
select tests.exec_as('authenticated', tests.id('adm'),
  $$select public.review_business(tests.id('v1'), 'suspended', 'Datos falsos', tests.seen('v1'))$$);
select tests.expect_true('authenticated', tests.id('adm'),
  $$select verification_status = 'suspended' from public.businesses where id = tests.id('v1')$$,
  'pending can be suspended');

-- -- reactivation and invalid transitions -------------------------------------------
select tests.expect_error('authenticated', tests.id('adm'),
  $$select public.review_business(tests.id('v1'), 'rejected', 'No', tests.seen('v1'))$$, 'invalid_transition');
select tests.exec_as('authenticated', tests.id('adm'),
  $$select public.review_business(tests.id('v1'), 'approved', null, tests.seen('v1'))$$);
select tests.expect_true('authenticated', tests.id('owner'), $$
  select (select verification_status = 'approved' and verification_note is null
          from public.businesses where id = tests.id('v1'))
     and (select array_agg(status order by created_at, status) from public.notifications
          where type = 'business_review' and business_id = tests.id('v1'))
         @> array['suspended', 'approved']$$,
  'suspended businesses can be reactivated and the owner hears about both');
select tests.expect_error('authenticated', tests.id('adm'),
  $$select public.review_business(tests.id('v1'), 'approved', null, tests.seen('v1'))$$, 'invalid_transition');

-- -- abuse --------------------------------------------------------------------------------
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.review_business(tests.id('v1'), 'approved', null, tests.seen('v1'))$$, 'not_admin');
select tests.expect_error('authenticated', tests.id('eve'),
  $$select public.review_business(tests.id('v1'), 'suspended', 'x', tests.seen('v1'))$$, 'not_admin');
select tests.expect_error('anon', null,
  $$select public.review_business(tests.id('v1'), 'approved', null, now())$$, 'permission denied');
-- The review team corrects a business under review from the SQL editor (no API role).
update public.businesses set verification_status = 'pending' where id = tests.id('v1');
update public.businesses set name = 'Nombre corregido' where id = tests.id('v1');
select tests.expect_true('postgres', null,
  $$select name = 'Nombre corregido' from public.businesses where id = tests.id('v1')$$,
  'the SQL editor can still fix name or address while pending');

rollback;
