-- -----------------------------------------------------------------------------
-- Business anti-fraud and sales: tax_id_in_use on submit (approved NIT of another owner), business_review_flags
-- (admin with aal2), owner_sales_daily (owner only). Roles: owner (v1, pub),
-- another owner (eve), customer (cus), admin (adm) with aal1 and aal2, anon.
-- Rolled back at the end.
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _verification_fixtures.sql

-- v1 is complete for review; eve has e1 with the same NIT.
insert into public.business_legal (business_id, tax_id, legal_name, legal_rep_name)
values (tests.id('v1'), '800197268-4', 'Fritanga SAS', 'Ana Pérez');
insert into public.business_verification_docs (business_id, kind, storage_path) values
  (tests.id('v1'), 'rut', tests.doc_path('rut')), (tests.id('v1'), 'facade', tests.doc_path('facade', 'jpg'));
insert into public.businesses (id, owner_id, name, category, latitude, longitude, address, phone, is_active) values
  (tests.id('e1'), tests.id('eve'), 'Fritanga Nuevas', 'Restaurante', 1.2101, -77.2801, 'Calle 18 # 25-32',
   '+573001112233', true);
insert into public.business_legal (business_id, tax_id, legal_name, legal_rep_name)
values (tests.id('e1'), '800197268-4', 'Otra SAS', 'Eva Ruiz');

-- -- tax_id_in_use ---------------------------------------------------------------------
select tests.expect_true('authenticated', tests.id('owner'),
  $$select (public.submit_business_for_review(tests.id('v1')) ->> 'ok')::boolean$$,
  'a NIT used only by a draft of another user does not block');
update public.businesses set verification_status = 'draft' where id = tests.id('v1');
update public.businesses set verification_status = 'pending' where id = tests.id('e1');
select tests.expect_true('authenticated', tests.id('owner'),
  $$select (public.submit_business_for_review(tests.id('v1')) ->> 'ok')::boolean$$,
  'a NIT of a pending business of another user does not block either (only a review flag)');
update public.businesses set verification_status = 'draft' where id = tests.id('v1');
update public.businesses set verification_status = 'approved' where id = tests.id('e1');
select tests.expect_error('authenticated', tests.id('owner'),
  $$select public.submit_business_for_review(tests.id('v1'))$$, 'tax_id_in_use');
select tests.expect_error('authenticated', tests.id('owner'), $$select public.tax_id_taken(tests.id('v1'))$$,
  'permission denied');

-- -- business_review_flags --------------------------------------------------------------------
select tests.use_aal('aal1');
select tests.expect_error('authenticated', tests.id('adm'), $$select * from public.business_review_flags(tests.id('v1'))$$,
  'not_admin');
select tests.use_aal('aal2');
select tests.expect_error('authenticated', tests.id('cus'), $$select * from public.business_review_flags(tests.id('v1'))$$,
  'not_admin');
select tests.expect_error('anon', null, $$select * from public.business_review_flags(tests.id('v1'))$$, 'permission denied');
select tests.expect_true('authenticated', tests.id('adm'), $$
  select duplicate_tax_id and duplicate_phone and near_duplicate_location and similar_name
     and owner_account_age_days = 0 and owner_business_count = 2
  from public.business_review_flags(tests.id('v1'))$$,
  'same NIT, same phone, 15 m away, similar name: every sign is raised');
update public.businesses set phone = '+573110000000', latitude = 1.25, name = 'Panadería Lejana' where id = tests.id('e1');
update public.business_legal set tax_id = '890900608-9' where business_id = tests.id('e1');
select tests.expect_true('authenticated', tests.id('adm'), $$
  select not duplicate_tax_id and not duplicate_phone and not near_duplicate_location and not similar_name
  from public.business_review_flags(tests.id('v1'))$$, 'unrelated businesses raise nothing');
select tests.expect_error('authenticated', tests.id('adm'), $$select * from public.business_review_flags(tests.id('none'))$$,
  'business_not_found');

-- -- owner_sales_daily --------------------------------------------------------------------------
insert into public.orders (id, user_id, business_id, business_name, business_address, total_cop, status, created_at) values
  (tests.id('s1'), tests.id('cus'), tests.id('pub'), 'Café', 'Calle', 4000, 'picked_up', now()),
  (tests.id('s2'), tests.id('cus'), tests.id('pub'), 'Café', 'Calle', 2000, 'pending', now() - interval '2 days'),
  (tests.id('s3'), tests.id('cus'), tests.id('pub'), 'Café', 'Calle', 9000, 'cancelled', now()),
  (tests.id('s4'), tests.id('cus'), tests.id('pub'), 'Café', 'Calle', 8000, 'awaiting_payment', now()),
  (tests.id('s5'), tests.id('cus'), tests.id('pub'), 'Café', 'Calle', 1000, 'picked_up', now() - interval '20 days');
insert into public.order_items (order_id, name, unit_price_cop, list_price_cop, quantity) values
  (tests.id('s1'), 'Tinto', 2000, 2000, 2), (tests.id('s2'), 'Pan', 2000, 2000, 1), (tests.id('s3'), 'Torta', 9000, 9000, 9);
select tests.expect_true('authenticated', tests.id('owner'), $$
  with r as (select public.owner_sales_daily(tests.id('pub'), 7) as j)
  select jsonb_array_length(j -> 'days') = 7
     and (select sum((d ->> 'orders')::int) from jsonb_array_elements(j -> 'days') d) = 2
     and (select sum((d ->> 'revenue_cop')::int) from jsonb_array_elements(j -> 'days') d) = 6000
     and j -> 'top_items' -> 0 ->> 'name' = 'Tinto' and jsonb_array_length(j -> 'top_items') = 2
  from r$$, 'seven days with zeros; cancelled and unpaid orders left out');
select tests.expect_true('authenticated', tests.id('owner'), $$
  select (select sum((d ->> 'orders')::int) from jsonb_array_elements(public.owner_sales_daily(tests.id('pub'), 30) -> 'days') d) = 3$$,
  'thirty days include older orders');
select tests.expect_error('authenticated', tests.id('eve'), $$select public.owner_sales_daily(tests.id('pub'), 7)$$,
  'not_business_owner');
select tests.expect_error('authenticated', tests.id('owner'), $$select public.owner_sales_daily(tests.id('pub'), 14)$$,
  'invalid_range');
select tests.expect_error('anon', null, $$select public.owner_sales_daily(tests.id('pub'), 7)$$, 'permission denied');

rollback;
