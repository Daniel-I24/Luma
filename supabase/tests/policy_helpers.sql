-- -----------------------------------------------------------------------------
-- Direct checks of the helpers used inside policies (closed to anon, right
-- answer for each role). Roles: anon, owner, another owner (eve), customer
-- (cus), admin (adm). Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql

select tests.expect_error('anon', null, $$select public.is_admin()$$, 'permission denied');
select tests.expect_error('anon', null, $$select public.owns_business(tests.id('pub'))$$, 'permission denied');
select tests.expect_error('anon', null, $$select public.owns_editable_business(tests.id('v1'))$$, 'permission denied');
select tests.expect_error('anon', null, $$select public.normalize_co_mobile('3001234567')$$, 'permission denied');
select tests.expect_error('anon', null, $$select public.verification_doc_business('x')$$, 'permission denied');
select tests.expect_error('anon', null, $$select public.business_image_count('x/logo/y.webp')$$, 'permission denied');

select tests.expect_true('authenticated', tests.id('adm'), $$select public.is_admin()$$, 'an admin is admin');
select tests.expect_true('authenticated', tests.id('owner'), $$select not public.is_admin()$$, 'an owner is not admin');

select tests.expect_true('authenticated', tests.id('owner'),
  $$select public.owns_business(tests.id('pub')) and public.owns_business(tests.id('v1'))$$, 'the owner owns both');
select tests.expect_true('authenticated', tests.id('eve'),
  $$select not public.owns_business(tests.id('pub'))$$, 'another owner does not');
select tests.expect_true('authenticated', tests.id('adm'),
  $$select not public.owns_business(tests.id('pub'))$$, 'admins do not own businesses');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select public.owns_editable_business(tests.id('v1')) and not public.owns_editable_business(tests.id('pub'))$$,
  'drafts are editable, approved businesses are not');

select tests.expect_true('authenticated', tests.id('cus'), $$
  select public.normalize_co_mobile('300 123 4567') = '+573001234567'
     and public.normalize_co_mobile('+57 (300) 123-4567') = '+573001234567'
     and public.normalize_co_mobile('6012345678') is null
     and public.normalize_co_mobile(null) is null$$, 'Colombian mobiles are normalised, others null');

select tests.expect_true('authenticated', tests.id('cus'), $$
  select public.verification_doc_business(tests.doc_path('rut')) = tests.id('v1')
     and public.verification_doc_business(tests.id('v1')::text || '/selfie/x.pdf') is null
     and public.verification_doc_business('../' || tests.doc_path('rut')) is null$$,
  'only well-formed document paths name a business');

insert into storage.objects (bucket_id, name)
select 'business-images', tests.id('pub')::text || '/menu/' || tests.id('f' || n)::text || '.webp' from generate_series(1, 3) n;
insert into storage.objects (bucket_id, name)
values ('verification-docs', tests.id('pub')::text || '/rut/' || tests.id('r')::text || '.pdf');
select tests.expect_true('authenticated', tests.id('eve'),
  $$select public.business_image_count(tests.id('pub')::text || '/logo/a.webp') = 3$$,
  'counts the business-images files of that business folder only');

rollback;
