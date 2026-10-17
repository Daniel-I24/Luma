-- -----------------------------------------------------------------------------
-- Business images: Storage policies of the business-images bucket and the
-- https-only image URL columns. Run like orders_security.sql (needs the
-- storage schema: a Supabase database, or supabase/tests/local/ stubs).
-- -----------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;
\ir _helpers.sql
\ir _business_panel_fixtures.sql

insert into public.businesses (id, owner_id, name, category, latitude, longitude, address, is_active) values
  (tests.id('mine'), tests.id('owner'), 'Mi Fritanga', 'Restaurante', 1.21, -77.28, 'Calle 18 # 25-30', false);
insert into storage.buckets (id, name) values ('other', 'other');

-- Object path of a business picture: {business}/{kind}/{uuid}.{ext}.
create function tests.image_path(p_business text, p_kind text, p_ext text default 'webp')
returns text language sql immutable
as $$ select tests.id(p_business)::text || '/' || p_kind || '/' || tests.id('file-' || p_kind)::text || '.' || p_ext $$;
grant execute on function tests.image_path(text, text, text) to anon, authenticated;

select tests.expect_true('service_role', null,
  $$select public and file_size_limit = 2097152
       and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
    from storage.buckets where id = 'business-images'$$, 'bucket: public, 2 MB, JPEG/PNG/WebP');

-- -- uploads: only the owner, only in their business folder, only valid paths -
select tests.expect_error('anon', null,
  $$insert into storage.objects (bucket_id, name) values ('business-images', tests.image_path('mine', 'logo'))$$,
  'row-level security');
select tests.exec_as('authenticated', tests.id('owner'),
  $$insert into storage.objects (bucket_id, name) values ('business-images', tests.image_path('mine', 'logo'))$$);
select tests.exec_as('authenticated', tests.id('owner'),
  $$insert into storage.objects (bucket_id, name) values ('business-images', tests.image_path('mine', 'menu', 'jpg'))$$);
select tests.expect_error('authenticated', tests.id('owner'),
  $$insert into storage.objects (bucket_id, name) values ('business-images', tests.image_path('eve-biz', 'logo'))$$,
  'row-level security');
select tests.expect_error('authenticated', tests.id('owner'),
  $$insert into storage.objects (bucket_id, name) values ('business-images', tests.image_path('mine', 'secrets'))$$,
  'row-level security');
select tests.expect_error('authenticated', tests.id('owner'),
  $$insert into storage.objects (bucket_id, name) values ('business-images', tests.image_path('mine', 'logo', 'svg'))$$,
  'row-level security');
select tests.expect_error('authenticated', tests.id('owner'),
  $$insert into storage.objects (bucket_id, name)
    values ('business-images', tests.id('mine')::text || '/logo/../../' || tests.image_path('eve-biz', 'logo'))$$,
  'row-level security');
select tests.expect_error('authenticated', tests.id('owner'),
  $$insert into storage.objects (bucket_id, name) values ('business-images', 'logo.webp')$$, 'row-level security');
select tests.expect_error('authenticated', tests.id('owner'),
  $$insert into storage.objects (bucket_id, name) values ('other', tests.image_path('mine', 'logo'))$$,
  'row-level security');

-- -- anyone reads; nobody else updates, moves or deletes -----------------------
select tests.expect_true('anon', null,
  $$select count(*) = 2 from storage.objects where bucket_id = 'business-images'$$, 'public read');
select tests.exec_as('authenticated', tests.id('eve'),
  $$update storage.objects set metadata = '{"x": 1}' where name = tests.image_path('mine', 'logo')$$);
select tests.exec_as('authenticated', tests.id('eve'),
  $$delete from storage.objects where name = tests.image_path('mine', 'logo')$$);
select tests.expect_true('anon', null,
  $$select metadata is null from storage.objects where name = tests.image_path('mine', 'logo')$$,
  'another user cannot change or delete the object');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update storage.objects set name = tests.image_path('eve-biz', 'logo') where name = tests.image_path('mine', 'logo')$$,
  'row-level security');
select tests.exec_as('authenticated', tests.id('owner'),
  $$delete from storage.objects where name = tests.image_path('mine', 'menu', 'jpg')$$);
select tests.expect_true('anon', null,
  $$select count(*) = 1 from storage.objects where bucket_id = 'business-images'$$, 'the owner deletes their object');
select tests.expect_true('anon', null,
  $$select not has_function_privilege('anon', 'public.can_write_business_image(text)', 'execute')$$,
  'anon cannot call the path check');

-- -- image URLs: https only --------------------------------------------------------
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set logo_url = 'http://example.com/a.webp' where id = tests.id('mine')$$,
  'businesses_logo_url_https');
select tests.expect_error('authenticated', tests.id('owner'),
  $$update public.businesses set cover_url = 'javascript:alert(1)' where id = tests.id('mine')$$,
  'businesses_cover_url_https');
select tests.expect_error('authenticated', tests.id('eve'),
  $$update public.promotions set image_url = 'data:image/png;base64,AA' where business_id = tests.id('eve-biz')$$,
  'promotions_image_url_https');
select tests.exec_as('authenticated', tests.id('owner'),
  $$update public.businesses set logo_url = 'https://x.supabase.co/storage/v1/object/public/business-images/a.webp'
    where id = tests.id('mine')$$);

rollback;
