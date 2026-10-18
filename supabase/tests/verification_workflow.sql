-- -----------------------------------------------------------------------------
-- Verification workflow: legal data, documents (table and private bucket),
-- submit, admin decisions, notification and re-review. Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql

-- -- submit with data missing ----------------------------------------------------
select tests.expect_true('authenticated', tests.id('owner'),
  $$select (r ->> 'ok')::boolean = false
       and r -> 'missing' = '["legal", "doc_rut", "doc_facade"]'::jsonb
    from public.submit_business_for_review(tests.id('v1')) r$$, 'submit lists what is missing');
insert into public.businesses (id, owner_id, name, category, latitude, longitude, address, is_active)
values (tests.id('np'), tests.id('owner'), 'Sin teléfono', 'Bar', 1.21, -77.28, 'Calle 2 # 2-2', false);
select tests.expect_true('authenticated', tests.id('owner'),
  $$select r -> 'missing' ? 'phone' and r -> 'missing' ? 'open_day' and r -> 'missing' ? 'available_item'
    from public.submit_business_for_review(tests.id('np')) r$$, 'phone, hours and menu are required too');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.submit_business_for_review(tests.id('pub'))$$, 'not_submittable');
select tests.expect_error('authenticated', tests.id('eve'),
  $$select public.submit_business_for_review(tests.id('v1'))$$, 'business_not_found');

-- -- legal data (NIT with DIAN check digit) -------------------------------------------
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into public.business_legal (business_id, tax_id, legal_name, legal_rep_name)
  values (tests.id('v1'), '800197268-5', 'Fritanga SAS', 'Ana Pérez')$$, 'business_legal_tax_id_valid');
select tests.exec_as('authenticated', tests.id('owner'), $$
  insert into public.business_legal (business_id, tax_id, legal_name, legal_rep_name)
  values (tests.id('v1'), '800197268-4', 'Fritanga SAS', 'Ana Pérez')$$);
select tests.expect_true('authenticated', tests.id('eve'),
  $$select count(*) = 0 from public.business_legal$$, 'nobody else reads legal data');
select tests.expect_error('anon', null, $$select count(*) from public.business_legal$$, 'permission denied');
select tests.expect_true('authenticated', tests.id('adm'),
  $$select count(*) = 1 from public.business_legal$$, 'admins read legal data');

-- -- documents: rows and private bucket ---------------------------------------------
select tests.exec_as('authenticated', tests.id('owner'), $$
  insert into storage.objects (bucket_id, name) values
    ('verification-docs', tests.doc_path('rut')), ('verification-docs', tests.doc_path('facade', 'jpg'))$$);
select tests.exec_as('authenticated', tests.id('owner'), $$
  insert into public.business_verification_docs (business_id, kind, storage_path) values
    (tests.id('v1'), 'rut', tests.doc_path('rut')), (tests.id('v1'), 'facade', tests.doc_path('facade', 'jpg'))$$);
select tests.expect_error('authenticated', tests.id('eve'), $$
  insert into storage.objects (bucket_id, name) values ('verification-docs', tests.doc_path('other'))$$,
  'row-level security');
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into storage.objects (bucket_id, name)
  values ('verification-docs', tests.id('v1')::text || '/rut/../x.pdf')$$, 'row-level security');
select tests.expect_true('authenticated', tests.id('eve'),
  $$select (select count(*) from storage.objects where bucket_id = 'verification-docs') = 0
       and (select count(*) from public.business_verification_docs) = 0$$, 'nobody else sees documents');
select tests.expect_true('anon', null,
  $$select count(*) = 0 from storage.objects where bucket_id = 'verification-docs'$$, 'anon sees no documents');
select tests.expect_true('service_role', null,
  $$select not public and file_size_limit = 5242880 and 'application/pdf' = any (allowed_mime_types)
    from storage.buckets where id = 'verification-docs'$$, 'private bucket, 5 MB, PDF allowed');

-- -- submit, then nothing is editable until a decision -------------------------------
select tests.expect_true('authenticated', tests.id('owner'),
  $$select (r ->> 'ok')::boolean from public.submit_business_for_review(tests.id('v1')) r$$, 'complete: submitted');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select verification_status = 'pending' from public.businesses where id = tests.id('v1')$$, 'now pending');
select tests.expect_error('authenticated', tests.id('owner'), $$
  insert into storage.objects (bucket_id, name) values ('verification-docs', tests.doc_path('other'))$$,
  'row-level security');
select tests.exec_as('authenticated', tests.id('owner'),
  $$update public.business_legal set legal_name = 'Otro SAS' where business_id = tests.id('v1')$$);
select tests.expect_true('authenticated', tests.id('adm'),
  $$select legal_name = 'Fritanga SAS' from public.business_legal where business_id = tests.id('v1')$$,
  'legal data is frozen while pending');

-- -- decisions: admins only, note required to reject or suspend ---------------------
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.review_business(tests.id('v1'), 'approved')$$, 'not_admin');
select tests.expect_error('authenticated', tests.id('adm'),
  $$select public.review_business(tests.id('v1'), 'rejected', '  ')$$, 'note_required');
select tests.expect_error('anon', null,
  $$select public.review_business(tests.id('v1'), 'approved')$$, 'permission denied');
select tests.exec_as('authenticated', tests.id('adm'), $$select public.review_business(tests.id('v1'), 'approved')$$);
select tests.expect_true('anon', null,
  $$select count(*) = 1 from public.businesses where id = tests.id('v1')$$, 'approved and published: public');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select count(*) = 1 from public.notifications
    where type = 'business_review' and business_id = tests.id('v1') and status = 'approved'$$,
  'the owner is told about the decision');
select tests.expect_true('authenticated', tests.id('adm'),
  $$select count(*) = 2 from storage.objects where bucket_id = 'verification-docs'$$, 'admins read the documents');
select tests.exec_as('authenticated', tests.id('adm'), $$
  delete from storage.objects where bucket_id = 'verification-docs';
  delete from public.business_verification_docs where business_id = tests.id('v1')$$);

-- -- re-review after sensitive changes, suspension -----------------------------------
select tests.exec_as('authenticated', tests.id('owner'),
  $$update public.businesses set description = 'Nueva carta' where id = tests.id('v1')$$);
select tests.expect_true('authenticated', tests.id('owner'),
  $$select verification_status = 'approved' from public.businesses where id = tests.id('v1')$$,
  'other changes keep it approved');
select tests.exec_as('authenticated', tests.id('owner'),
  $$update public.businesses set address = 'Carrera 27 # 10-1' where id = tests.id('v1')$$);
select tests.expect_true('authenticated', tests.id('owner'),
  $$select verification_status = 'pending' from public.businesses where id = tests.id('v1')$$,
  'a new address sends it back to review');
select tests.exec_as('authenticated', tests.id('adm'), $$select public.review_business(tests.id('v1'), 'approved')$$);
select tests.exec_as('authenticated', tests.id('adm'),
  $$select public.review_business(tests.id('v1'), 'suspended', 'Reportes de información falsa')$$);
select tests.expect_true('anon', null,
  $$select count(*) = 0 from public.businesses where id = tests.id('v1')$$, 'a suspended business is hidden');

rollback;
